import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const BUCKET_NAME = 'public-files';
const META_FILE = '_meta.json';

// Helper: Deteksi kategori berdasarkan ekstensi atau mime type
function detectCategory(filename = '', mimeType = '') {
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'];
	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
	const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'wmv'];
	const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
	const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
	const codeExts = ['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'sql', 'xml'];

	if (docExts.includes(ext) || mimeType.includes('pdf') || mimeType.includes('officedocument') || mimeType.includes('msword')) {
		return 'dokumen';
	}
	if (imageExts.includes(ext) || mimeType.startsWith('image/')) {
		return 'gambar';
	}
	if (videoExts.includes(ext) || mimeType.startsWith('video/')) {
		return 'video';
	}
	if (audioExts.includes(ext) || mimeType.startsWith('audio/')) {
		return 'audio';
	}
	if (archiveExts.includes(ext) || mimeType.includes('zip') || mimeType.includes('compressed')) {
		return 'arsip';
	}
	if (codeExts.includes(ext) || mimeType.startsWith('text/') || mimeType.includes('json')) {
		return 'kode_teks';
	}
	return 'lainnya';
}

// Helper: Format ukuran file menjadi KB/MB/GB
function formatBytes(bytes, decimals = 1) {
	if (!bytes || bytes === 0) return '0 B';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Ambil atau inisialisasi metadata dari bucket
async function getMetadataRegistry() {
	try {
		const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(META_FILE);
		if (error || !data) return [];
		const text = await data.text();
		return JSON.parse(text || '[]');
	} catch (err) {
		console.warn('Gagal membaca metadata:', err.message);
		return [];
	}
}

// Simpan update metadata ke bucket
async function saveMetadataRegistry(metaList) {
	try {
		const buffer = Buffer.from(JSON.stringify(metaList, null, 2));
		await supabaseAdmin.storage.from(BUCKET_NAME).upload(META_FILE, buffer, {
			contentType: 'application/json',
			upsert: true,
		});
	} catch (err) {
		console.error('Gagal menyimpan metadata:', err.message);
	}
}

// GET: Ambil daftar seluruh file
export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const searchQuery = (searchParams.get('q') || '').toLowerCase().trim();
		const categoryFilter = searchParams.get('category') || '';

		// Pastikan bucket ada
		const { data: buckets } = await supabaseAdmin.storage.listBuckets();
		if (!buckets?.some((b) => b.name === BUCKET_NAME)) {
			await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true });
		}

		// List semua objek di storage
		const { data: storageObjects, error: storageError } = await supabaseAdmin.storage
			.from(BUCKET_NAME)
			.list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

		if (storageError) {
			console.error('Storage list error:', storageError);
			return NextResponse.json({ error: storageError.message }, { status: 500 });
		}

		// Filter out sistem metadata file
		const actualFiles = (storageObjects || []).filter(
			(item) => item.name !== META_FILE && !item.name.startsWith('.') && item.name.trim() !== ''
		);

		// Baca metadata registry
		const registry = await getMetadataRegistry();
		const registryMap = new Map(registry.map((r) => [r.stored_name || r.name, r]));

		// Sinkronisasi data storage dengan metadata registry
		let items = actualFiles.map((file) => {
			const meta = registryMap.get(file.name) || {};
			const originalName = meta.original_name || file.name;
			const mimeType = meta.type || file.metadata?.mimetype || 'application/octet-stream';
			const category = meta.category || detectCategory(originalName, mimeType);
			const size = meta.size || file.metadata?.size || 0;
			const uploadedAt = meta.uploaded_at || file.created_at || new Date().toISOString();

			const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(file.name);

			return {
				id: meta.id || file.id || file.name,
				stored_name: file.name,
				original_name: originalName,
				title: meta.title || originalName,
				description: meta.description || '',
				size,
				formatted_size: formatBytes(size),
				type: mimeType,
				category,
				uploaded_at: uploadedAt,
				url: urlData?.publicUrl || '',
			};
		});

		// Filter berdasarkan search query
		if (searchQuery) {
			items = items.filter(
				(item) =>
					item.original_name.toLowerCase().includes(searchQuery) ||
					item.title.toLowerCase().includes(searchQuery) ||
					item.description.toLowerCase().includes(searchQuery)
			);
		}

		// Filter berdasarkan kategori
		if (categoryFilter && categoryFilter !== 'semua') {
			items = items.filter((item) => item.category === categoryFilter);
		}

		// Statistik ringkas
		const totalBytes = items.reduce((acc, cur) => acc + (cur.size || 0), 0);
		const categoryCounts = items.reduce((acc, cur) => {
			acc[cur.category] = (acc[cur.category] || 0) + 1;
			return acc;
		}, {});

		return NextResponse.json({
			success: true,
			data: items,
			stats: {
				totalFiles: items.length,
				totalSize: formatBytes(totalBytes),
				categoryCounts,
			},
		});
	} catch (err) {
		console.error('API Berkas GET error:', err);
		return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
	}
}

// POST: Unggah file baru (single atau multiple)
export async function POST(request) {
	try {
		const formData = await request.formData();
		const files = formData.getAll('files');
		const singleFile = formData.get('file');
		const customTitle = formData.get('title') || '';
		const customCategory = formData.get('category') || '';
		const description = formData.get('description') || '';

		const filesToUpload = [];
		if (files && files.length > 0) {
			for (const f of files) {
				if (f && typeof f === 'object' && f.name) filesToUpload.push(f);
			}
		}
		if (singleFile && typeof singleFile === 'object' && singleFile.name && !filesToUpload.includes(singleFile)) {
			filesToUpload.push(singleFile);
		}

		if (filesToUpload.length === 0) {
			return NextResponse.json({ error: 'Tidak ada file yang dipilih untuk diunggah' }, { status: 400 });
		}

		// Ambil metadata saat ini
		const registry = await getMetadataRegistry();
		const uploadedRecords = [];

		for (const file of filesToUpload) {
			const originalName = file.name;
			const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
			const timestamp = Date.now();
			const randomSuffix = Math.random().toString(36).substring(2, 7);
			const storedName = `${timestamp}_${randomSuffix}_${cleanName}`;

			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const mimeType = file.type || 'application/octet-stream';
			const detectedCat = customCategory && customCategory !== 'otomatis'
				? customCategory
				: detectCategory(originalName, mimeType);

			// Upload ke Supabase Storage
			const { error: uploadError } = await supabaseAdmin.storage
				.from(BUCKET_NAME)
				.upload(storedName, buffer, {
					contentType: mimeType,
					upsert: false,
				});

			if (uploadError) {
				console.error(`Gagal mengunggah file ${originalName}:`, uploadError);
				continue;
			}

			const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storedName);

			const newRecord = {
				id: `${timestamp}_${randomSuffix}`,
				stored_name: storedName,
				original_name: originalName,
				title: customTitle.trim() ? customTitle.trim() : originalName,
				description: description.trim(),
				size: file.size,
				type: mimeType,
				category: detectedCat,
				uploaded_at: new Date().toISOString(),
				url: urlData?.publicUrl || '',
			};

			registry.unshift(newRecord);
			uploadedRecords.push(newRecord);
		}

		// Simpan perubahan metadata
		await saveMetadataRegistry(registry);

		return NextResponse.json({
			success: true,
			message: `${uploadedRecords.length} berkas berhasil diunggah`,
			data: uploadedRecords,
		});
	} catch (err) {
		console.error('API Berkas POST error:', err);
		return NextResponse.json({ error: err.message || 'Gagal mengunggah berkas' }, { status: 500 });
	}
}

// DELETE: Hapus file dari storage dan metadata
export async function DELETE(request) {
	try {
		const { searchParams } = new URL(request.url);
		let storedName = searchParams.get('name');

		if (!storedName) {
			try {
				const body = await request.json();
				storedName = body?.name;
			} catch (_) {}
		}

		if (!storedName) {
			return NextResponse.json({ error: 'Nama berkas tidak disertakan' }, { status: 400 });
		}

		// Hapus dari Supabase Storage
		const { error: deleteError } = await supabaseAdmin.storage
			.from(BUCKET_NAME)
			.remove([storedName]);

		if (deleteError) {
			console.error('Gagal menghapus file dari storage:', deleteError);
			return NextResponse.json({ error: deleteError.message }, { status: 500 });
		}

		// Hapus dari metadata registry
		const registry = await getMetadataRegistry();
		const updatedRegistry = registry.filter((r) => r.stored_name !== storedName && r.name !== storedName);
		await saveMetadataRegistry(updatedRegistry);

		return NextResponse.json({
			success: true,
			message: 'Berkas berhasil dihapus',
		});
	} catch (err) {
		console.error('API Berkas DELETE error:', err);
		return NextResponse.json({ error: err.message || 'Gagal menghapus berkas' }, { status: 500 });
	}
}
