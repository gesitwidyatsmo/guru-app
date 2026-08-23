import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

// GET JURNAL
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

		const supabase = await createClient();
		let query = supabase.from('jurnal').select('*').order('tanggal', { ascending: false });

		// 1. Filter Isolasi Hak Akses (Guru hanya melihat miliknya)
		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		// 2. Filter dari Parameter URL
		if (kelas) query = query.eq('kelas', kelas);
		if (mapel) query = query.eq('mapel', mapel);
		// 3. Filter Periode Akademik
		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester));

		const { data, error } = await query;
		if (error) throw error;

		return NextResponse.json(data || [], { status: 200 });
	} catch (error) {
		console.error('❌ Error GET jurnal:', error);
		return NextResponse.json({ error: 'Gagal ambil data' }, { status: 500 });
	}
}

// POST JURNAL BARU
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const { tanggal, jam_ke, pertemuan_ke, kelas, mapel, materi, kegiatan, hambatan, solusi, tuntas, tahun_ajar, semester } = body;

		const supabase = await createClient();
		const id = generateId();

		const { error } = await supabase.from('jurnal').insert({
			id,
			guru_id: userId || null,
			tanggal,
			jam_ke: jam_ke || '',
			pertemuan_ke: pertemuan_ke || '',
			kelas,
			mapel,
			materi,
			kegiatan: kegiatan || '',
			hambatan: hambatan || '',
			solusi: solusi || '',
			tuntas: !!tuntas,
			tahun_ajar: tahun_ajar || '2026/2027',
			semester: semester ? parseInt(semester) : 1,
		});

		if (error) throw error;

		return NextResponse.json({ success: true, id }, { status: 201 });
	} catch (error) {
		console.error('❌ Error POST jurnal:', error);
		return NextResponse.json({ error: 'Gagal simpan' }, { status: 500 });
	}
}

// PUT UPDATE JURNAL
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const { id, pertemuan_ke, ...others } = body;

		const supabase = await createClient();
		
		// Verifikasi kepemilikan jika Guru
		if (role === 'Guru') {
			const { data: existingData } = await supabase.from('jurnal').select('guru_id').eq('id', id).single();
			if (!existingData) {
				return NextResponse.json({ error: 'Data Jurnal spesifik tidak ditemukan' }, { status: 404 });
			}
			if (existingData.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Ini bukan Jurnal ciptaan Anda!' }, { status: 403 });
			}
		}

		const updates = { ...others };
		if (pertemuan_ke !== undefined) updates.pertemuan_ke = pertemuan_ke;
		if (updates.tuntas !== undefined) updates.tuntas = !!updates.tuntas;

		const { error } = await supabase.from('jurnal').update(updates).eq('id', id);
		
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('PUT Jurnal Error:', error);
		return NextResponse.json({ error: 'Gagal update' }, { status: 500 });
	}
}

// DELETE JURNAL
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();

		// Verifikasi kepemilikan jika Guru
		if (role === 'Guru') {
			const { data: existingData } = await supabase.from('jurnal').select('guru_id').eq('id', id).single();
			if (!existingData) {
				return NextResponse.json({ error: 'Data Jurnal spesifik tidak ditemukan' }, { status: 404 });
			}
			if (existingData.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Anda mencoba menghapus Jurnal kolega Anda.' }, { status: 403 });
			}
		}

		const { error } = await supabase.from('jurnal').delete().eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('DELETE Jurnal Error:', error);
		return NextResponse.json({ error: 'Gagal hapus' }, { status: 500 });
	}
}
