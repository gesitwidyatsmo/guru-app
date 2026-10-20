import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

// GET — Ambil data KKTP untuk semua mapel atau per periode
export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const tahunAjar = searchParams.get('tahun_ajar') || '2026/2027';
		const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')) : 1;

		const supabase = supabaseAdmin || (await createClient());

		const { data, error } = await supabase
			.from('kurikulum_kktp')
			.select('*, mapel:mapel_id(id, mapel)')
			.order('id', { ascending: true });

		if (error) throw error;

		return NextResponse.json(data || []);
	} catch (error) {
		console.error('Error GET KKTP:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// PUT / POST — Simpan atau perbarui nilai KKTP per mapel dan tingkatan kelas
export async function PUT(request) {
	try {
		const role = request.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Kurikulum') {
			return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Kurikulum)' }, { status: 403 });
		}

		const body = await request.json();
		const items = Array.isArray(body) ? body : [body];

		if (items.length === 0) {
			return NextResponse.json({ error: 'Data KKTP tidak boleh kosong' }, { status: 400 });
		}

		const supabase = supabaseAdmin || (await createClient());

		const rowsToUpsert = items.map((item) => ({
			mapel_id: item.mapel_id,
			tingkat_kelas: item.tingkat_kelas,
			nilai_kktp: item.nilai_kktp !== null && item.nilai_kktp !== '' && !isNaN(Number(item.nilai_kktp)) ? Number(item.nilai_kktp) : null,
			keterangan: item.keterangan || (item.nilai_kktp != null ? String(item.nilai_kktp) : null),
			tahun_ajar_id: item.tahun_ajar_id || '2026/2027',
			semester: item.semester ? parseInt(item.semester) : 1,
			updated_at: new Date().toISOString(),
		}));

		const { data, error } = await supabase
			.from('kurikulum_kktp')
			.upsert(rowsToUpsert, {
				onConflict: 'mapel_id,tingkat_kelas,tahun_ajar_id,semester',
			})
			.select();

		if (error) throw error;

		return NextResponse.json({ success: true, count: rowsToUpsert.length, data });
	} catch (error) {
		console.error('Error PUT KKTP:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
