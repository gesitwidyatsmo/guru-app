import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET - List semua tahun ajar
export async function GET() {
	try {
		const supabase = await createClient();
		const { data, error } = await supabase
			.from('tahun_ajar')
			.select('*')
			.order('nama', { ascending: false })
			.order('semester', { ascending: true });

		if (error) throw error;

		return NextResponse.json(data || []);
	} catch (error) {
		console.error('GET tahun_ajar error:', error);
		return NextResponse.json({ error: 'Gagal mengambil data tahun ajar' }, { status: 500 });
	}
}

// POST - Buat tahun ajar baru (Admin only)
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses ditolak: khusus Admin' }, { status: 403 });
		}

		const body = await req.json();
		const { nama, semester, tanggal_mulai, tanggal_selesai } = body;

		if (!nama || !semester) {
			return NextResponse.json({ error: 'nama dan semester wajib diisi' }, { status: 400 });
		}

		const id = `TA-${nama.replace('/', '-')}-S${semester}`;
		const supabase = await createClient();

		const { error } = await supabase.from('tahun_ajar').insert({
			id,
			nama,
			semester: parseInt(semester),
			is_aktif: false,
			tanggal_mulai: tanggal_mulai || null,
			tanggal_selesai: tanggal_selesai || null,
		});

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: `Tahun Ajar ${nama} Semester ${semester} sudah ada` }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true, id }, { status: 201 });
	} catch (error) {
		console.error('POST tahun_ajar error:', error);
		return NextResponse.json({ error: 'Gagal membuat tahun ajar' }, { status: 500 });
	}
}
