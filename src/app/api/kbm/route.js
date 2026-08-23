import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateKBMId() {
	return 'KBM-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ---------------------------------------------------------------------------
// METHOD GET - Ambil Seluruh Data Penugasan Mengajar + Nama Guru (Join Tabel)
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		const supabase = await createClient();
		const { searchParams } = new URL(req.url);
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');
		
		let kbmQuery = supabase
			.from('guru_kbm')
			.select(`
				id_kbm,
				id_user,
				kelas,
				mapel,
				tahun_ajar,
				semester,
				users!guru_kbm_id_user_fkey(username, nama_lengkap)
			`);

		if (tahunAjar) kbmQuery = kbmQuery.eq('tahun_ajar', tahunAjar);
		if (semester) kbmQuery = kbmQuery.eq('semester', parseInt(semester));

		const { data: kbmData, error } = await kbmQuery;

		if (error) throw error;

		const result = (kbmData || []).map((r) => ({
			id_kbm: r.id_kbm,
			id_user: r.id_user,
			username: r.users?.username || 'Akun Terhapus',
			nama_guru: r.users?.nama_lengkap || 'Akun Terhapus',
			kelas: r.kelas,
			mapel: r.mapel,
		}));

		result.sort((a, b) => a.nama_guru.localeCompare(b.nama_guru));

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error('Error GET Penugasan:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan penarikan data relasional.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD POST - Menugaskan Kombinasi (Satu atau banyak row) KBM
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const assignments = Array.isArray(body) ? body : [body];

		if (assignments.length === 0) {
			return NextResponse.json({ error: 'Data penugasan tidak terbaca.' }, { status: 400 });
		}

		const supabase = await createClient();

		const rowsToInsert = assignments.map((task) => ({
			id_kbm: generateKBMId(),
			id_user: task.id_user,
			kelas: task.kelas,
			mapel: task.mapel,
			tahun_ajar: task.tahun_ajar || '2026/2027',
			semester: task.semester ? parseInt(task.semester) : 1,
		}));

		const { error } = await supabase.from('guru_kbm').insert(rowsToInsert);
		if (error) throw error;

		return NextResponse.json({ success: true, message: `${rowsToInsert.length} jadwal mengajar telah berhasil diformalkan.` }, { status: 201 });
	} catch (error) {
		console.error('Error POST KBM:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan perekaman database.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD DELETE - Mencabut satu jam mengajar guru
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id_kbm = searchParams.get('id_kbm');

		if (!id_kbm) {
			return NextResponse.json({ error: 'ID penugasan / Row tak ditemukan.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('guru_kbm').delete().eq('id_kbm', id_kbm);
		
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Hak mengajar kelas ini berhasil dicabut.' }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE KBM:', error);
		return NextResponse.json({ error: 'Pencabutan wewenang gagal.' }, { status: 500 });
	}
}
