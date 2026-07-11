import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return 'GRP-' + Date.now().toString(36).toUpperCase();
}

// GET: Ambil data grup LENGKAP dengan nama siswa
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const supabase = await createClient();

		// 1. Ambil Data Grup
		let query = supabase.from('grup').select('*').order('tanggal', { ascending: false });

		// Implementasikan Isolasi Kepemilikan (Khusus Guru)
		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		const { data: rowsGrup, error: grupError } = await query;
		if (grupError) throw grupError;

		// 2. Ambil Data Siswa (untuk Lookup Nama)
		const { data: rowsSiswa, error: siswaError } = await supabase.from('siswa').select('id, nama_lengkap');
		if (siswaError) throw siswaError;

		const siswaMap = {};
		(rowsSiswa || []).forEach((row) => {
			siswaMap[row.id] = {
				id: row.id,
				nama: row.nama_lengkap,
			};
		});

		// 3. Gabungkan Data (Hydration Process)
		const groups = (rowsGrup || []).map((row) => {
			let parsedJson = [];
			try {
				parsedJson = row.data_json || [];
				if (typeof parsedJson === 'string') {
					parsedJson = JSON.parse(parsedJson);
				}
			} catch (e) {
				parsedJson = [];
			}

			const hydratedJson = parsedJson.map((group) => ({
				...group,
				members: (group.anggota_ids || []).map((siswaId) => {
					return siswaMap[siswaId] || { id: siswaId, nama: 'Siswa Tidak Dikenal' };
				}),
			}));

			return {
				id: row.id,
				guru_id: row.guru_id || '',
				judul_kegiatan: row.judul_kegiatan,
				kelas_id: row.kelas_id,
				mapel_id: row.mapel_id,
				tanggal: row.tanggal,
				total_grup: parsedJson.length,
				total_siswa: parsedJson.reduce((acc, curr) => acc + (curr.anggota_ids?.length || 0), 0),
				raw_json: hydratedJson,
			};
		});

		return NextResponse.json(groups);
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// POST: Simpan grup baru
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		
		const supabase = await createClient();
		const newId = generateId();

		const { error } = await supabase.from('grup').insert({
			id: newId,
			guru_id: userId || null,
			judul_kegiatan: body.judul_kegiatan,
			kelas_id: body.kelas_id,
			mapel_id: body.mapel_id || '-',
			tanggal: new Date().toISOString().split('T')[0],
			data_json: body.data_grup,
		});

		if (error) throw error;

		return NextResponse.json({ success: true, id: newId }, { status: 201 });
	} catch (error) {
		console.error('API Error POST Grup:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// PUT: Update struktur grup yang sudah ada
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const { id, data_grup } = body;

		if (!id || !data_grup) {
			return NextResponse.json({ error: 'ID dan Data Grup wajib ada' }, { status: 400 });
		}

		const supabase = await createClient();

		const { data: rowToUpdate, error: fetchError } = await supabase.from('grup').select('guru_id').eq('id', id).single();

		if (fetchError || !rowToUpdate) {
			return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
		}

		// Proteksi: Hanya Pembuat yang Boleh Memodifikasi
		if (role === 'Guru' && String(rowToUpdate.guru_id) !== String(userId)) {
			return NextResponse.json({ error: 'Akses Ditolak: Anda mencoba menyunting Grup Formasi buatan orang lain.' }, { status: 403 });
		}

		// UPDATE DATA
		const { error } = await supabase.from('grup').update({
			data_json: data_grup
		}).eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Berhasil diupdate' });
	} catch (error) {
		console.error('API Error Update Grup:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// DELETE: Hapus grup berdasarkan ID
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID wajib ada' }, { status: 400 });
		}

		const supabase = await createClient();

		const { data: rowToDelete, error: fetchError } = await supabase.from('grup').select('guru_id').eq('id', id).single();

		if (fetchError || !rowToDelete) {
			return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
		}

		// Proteksi: Hanya Pembuat yang Boleh Menghapus
		if (role === 'Guru' && String(rowToDelete.guru_id) !== String(userId)) {
			return NextResponse.json({ error: 'Akses Ditolak: Anda mencoba menghapus Formasi Grup kolega.' }, { status: 403 });
		}

		const { error } = await supabase.from('grup').delete().eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Grup berhasil dihapus' });
	} catch (error) {
		console.error('API Error Delete Grup:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
