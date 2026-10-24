import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return 'POIN-' + Date.now() + Math.floor(Math.random() * 1000);
}

/** Ambil tahun_ajar & semester aktif dari DB server-side. */
async function getTAAktif(supabase) {
	const { data, error } = await supabase
		.from('tahun_ajar')
		.select('nama, semester')
		.eq('is_aktif', true)
		.single();
	if (error || !data) throw new Error('Tahun ajar aktif tidak ditemukan. Hubungi Admin untuk mengaktifkan tahun ajar.');
	return { nama: data.nama, semester: data.semester };
}

// =====================
// GET - Ambil Data Poin
// =====================
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const siswa_id = searchParams.get('siswa_id');
		const tipe = searchParams.get('tipe');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

		const supabase = await createClient();

		let query = supabase.from('poin').select(`
			id,
			siswa_id,
			guru_id,
			tanggal,
			tipe,
			kategori,
			aktifitas,
			poin,
			keterangan,
			created_at,
			guru:guru_id (
				nama_lengkap
			),
			siswa!inner (
				kelas
			)
		`);

		if (siswa_id) query = query.eq('siswa_id', siswa_id);
		if (tipe) query = query.eq('tipe', tipe);
		if (kelas) query = query.eq('siswa.kelas', kelas);
		// Filter Periode Akademik
		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester));

		const { data, error } = await query
			.order('tanggal', { ascending: false })
			.order('created_at', { ascending: false });
		if (error) throw error;

		let result = (data || []).map(d => ({
			id: d.id,
			siswa_id: d.siswa_id,
			guru_id: d.guru_id || '',
			tanggal: String(d.tanggal).slice(0, 10),
			tipe: d.tipe,
			kategori: d.kategori,
			aktifitas: d.aktifitas,
			poin: parseInt(d.poin || '0', 10),
			keterangan: d.keterangan,
			created_at: d.created_at,
			nama_guru: d.guru?.nama_lengkap || '',
			_kelas: d.siswa?.kelas // for filtering
		}));

		if (role === 'Guru') {
			const [resKbm, resWali] = await Promise.all([
				supabase.from('guru_kbm').select('kelas').eq('id_user', userId),
				supabase.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId),
			]);
			const kbmClasses = resKbm.data ? resKbm.data.map(r => r.kelas) : [];
			const waliClasses = resWali.data ? resWali.data.map(r => r.nama_kelas) : [];
			const allowedClasses = [...new Set([...kbmClasses, ...waliClasses])];

			result = result.filter(d => {
				const isAllowedClass = allowedClasses.includes(d._kelas);
				const isPembuat = String(d.guru_id) === String(userId);
				return isAllowedClass || isPembuat;
			});
		}

		// Remove temp field
		result.forEach(d => delete d._kelas);

		return NextResponse.json(result);
	} catch (error) {
		console.error('❌ Error GET poin:', error);
		return NextResponse.json({ error: 'Gagal mengambil data poin' }, { status: 500 });
	}
}

// =====================
// POST - Tambah Poin Baru
// =====================
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}

		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const { siswa_id, siswa_ids, tanggal, tipe, kategori, aktifitas, poin, keterangan, tahun_ajar, semester } = body;

		// Check if we have either a single siswa_id or an array of siswa_ids
		const targetSiswa = (siswa_ids && Array.isArray(siswa_ids) && siswa_ids.length > 0) 
			? siswa_ids 
			: (siswa_id ? [siswa_id] : []);

		if (targetSiswa.length === 0 || !tanggal || !tipe || !aktifitas || poin === undefined) {
			return NextResponse.json({ error: 'Field wajib: siswa_id/siswa_ids, tanggal, tipe, aktifitas, poin' }, { status: 400 });
		}

		const supabase = await createClient();

		// Gunakan tahun ajar dari body; jika tidak ada, ambil yang aktif dari DB
		const taAktif = (!tahun_ajar || !semester) ? await getTAAktif(supabase) : null;
		
		const inserts = targetSiswa.map((id, index) => ({
			id: generateId() + (index > 0 ? `-${index}` : ''),
			siswa_id: id,
			guru_id: userId || null,
			tanggal,
			tipe,
			kategori: kategori || '',
			aktifitas,
			poin: parseInt(poin, 10),
			keterangan: keterangan || '',
			tahun_ajar: tahun_ajar || taAktif.nama,
			semester: semester ? parseInt(semester) : taAktif.semester,
		}));

		const { error } = await supabase.from('poin').insert(inserts);

		if (error) throw error;

		return NextResponse.json({ success: true, count: inserts.length }, { status: 201 });
	} catch (error) {
		console.error('❌ Error POST poin:', error);
		return NextResponse.json({ error: 'Gagal menyimpan poin' }, { status: 500 });
	}
}

// =====================
// PUT - Update Poin
// =====================
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}

		const body = await req.json();
		const { id, ...updates } = body;

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();

		const { data: row, error: fetchError } = await supabase.from('poin').select('guru_id, siswa_id').eq('id', id).single();

		if (fetchError || !row) return NextResponse.json({ error: 'Data poin tidak ditemukan' }, { status: 404 });

		if (role === 'Guru') {
			const isPembuat = String(row.guru_id) === String(userId);
			let isWaliKelas = false;

			const { data: siswaData } = await supabase.from('siswa').select('kelas').eq('id', row.siswa_id).single();
			if (siswaData) {
				const { data: klsData } = await supabase.from('kelas').select('id_wali_kelas').eq('nama_kelas', siswaData.kelas).single();
				if (klsData && klsData.id_wali_kelas === userId) {
					isWaliKelas = true;
				}
			}

			if (!isPembuat && !isWaliKelas) {
				return NextResponse.json({ error: 'Akses Ditolak: Poin ini tidak dibuat oleh Anda dan bukan yurisdiksi kelas Anda.' }, { status: 403 });
			}
		}

		const validUpdates = {};
		const allowedFields = ['siswa_id', 'tanggal', 'tipe', 'kategori', 'aktifitas', 'poin', 'keterangan'];
		allowedFields.forEach((field) => {
			if (updates[field] !== undefined) {
				validUpdates[field] = field === 'poin' ? parseInt(updates[field], 10) : String(updates[field]);
			}
		});

		const { error } = await supabase.from('poin').update(validUpdates).eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('❌ Error PUT poin:', error);
		return NextResponse.json({ error: 'Gagal update poin' }, { status: 500 });
	}
}

// =====================
// DELETE - Hapus Poin
// =====================
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();

		const { data: row, error: fetchError } = await supabase.from('poin').select('guru_id, siswa_id').eq('id', id).single();

		if (fetchError || !row) return NextResponse.json({ error: 'Data poin tidak ditemukan' }, { status: 404 });

		if (role === 'Guru') {
			const isPembuat = String(row.guru_id) === String(userId);
			let isWaliKelas = false;

			const { data: siswaData } = await supabase.from('siswa').select('kelas').eq('id', row.siswa_id).single();
			if (siswaData) {
				const { data: klsData } = await supabase.from('kelas').select('id_wali_kelas').eq('nama_kelas', siswaData.kelas).single();
				if (klsData && klsData.id_wali_kelas === userId) {
					isWaliKelas = true;
				}
			}

			if (!isPembuat && !isWaliKelas) {
				return NextResponse.json({ error: 'Akses Ditolak: Penghapusan poin bukan wewenang Anda.' }, { status: 403 });
			}
		}

		const { error } = await supabase.from('poin').delete().eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('❌ Error DELETE poin:', error);
		return NextResponse.json({ error: 'Gagal hapus poin' }, { status: 500 });
	}
}
