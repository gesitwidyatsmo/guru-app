import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return 'POIN-' + Date.now() + Math.floor(Math.random() * 1000);
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
			siswa!inner (
				kelas
			)
		`);

		if (siswa_id) query = query.eq('siswa_id', siswa_id);
		if (tipe) query = query.eq('tipe', tipe);
		if (kelas) query = query.eq('siswa.kelas', kelas);

		// Filter Hak Akses Guru: Bisa lihat jika dia Wali Kelas, ATAU jika dia Pencatat Poin tersebut
		if (role === 'Guru' && userName) {
			const { data: kbmData } = await supabase.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId);
			const allowedClasses = (kbmData || []).map(r => r.nama_kelas);
			
			// Custom filter for RLS alternative:
			// In Supabase we set RLS for Poin: Guru can see all poin (so they can see students' points if they are homeroom teacher).
			// If not allowed class, then they can only see their own records.
			if (allowedClasses.length > 0) {
				// We can't do OR nicely with nested join directly without complex syntax, 
				// so we filter after fetching or use `or` syntax if we fetch all.
				// Since we need to join `siswa` to check `kelas`, let's just fetch and filter in JS if not using RPC.
			}
		}

		const { data, error } = await query.order('tanggal', { ascending: false });
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
			_kelas: d.siswa.kelas // for filtering
		}));

		if (role === 'Guru') {
			const { data: kbmData } = await supabase.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId);
			const allowedClasses = (kbmData || []).map(r => r.nama_kelas);
			
			result = result.filter(d => {
				const isWaliKelas = allowedClasses.includes(d._kelas);
				const isPembuat = String(d.guru_id) === String(userId);
				return isWaliKelas || isPembuat;
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
		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const { siswa_id, tanggal, tipe, kategori, aktifitas, poin, keterangan } = body;

		if (!siswa_id || !tanggal || !tipe || !aktifitas || poin === undefined) {
			return NextResponse.json({ error: 'Field wajib: siswa_id, tanggal, tipe, aktifitas, poin' }, { status: 400 });
		}

		const supabase = await createClient();
		const id = generateId();

		const { error } = await supabase.from('poin').insert({
			id,
			siswa_id,
			guru_id: userId || null,
			tanggal,
			tipe,
			kategori: kategori || '',
			aktifitas,
			poin: parseInt(poin, 10),
			keterangan: keterangan || '',
		});

		if (error) throw error;

		return NextResponse.json({ success: true, id }, { status: 201 });
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
