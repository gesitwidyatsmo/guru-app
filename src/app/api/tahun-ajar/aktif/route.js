import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET - Ambil periode yang sedang aktif
export async function GET() {
	try {
		const supabase = await createClient();
		const { data, error } = await supabase
			.from('tahun_ajar')
			.select('*')
			.eq('is_aktif', true)
			.single();

		if (error && error.code !== 'PGRST116') throw error;

		// Fallback jika tidak ada yang aktif
		if (!data) {
			return NextResponse.json({ nama: '2026/2027', semester: 1, id: 'TA-2026-S1', is_aktif: true });
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error('GET tahun_ajar/aktif error:', error);
		return NextResponse.json({ error: 'Gagal mengambil periode aktif' }, { status: 500 });
	}
}

// PATCH - Set tahun ajar tertentu sebagai aktif (Admin only)
export async function PATCH(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses ditolak: khusus Admin' }, { status: 403 });
		}

		const body = await req.json();
		const { id } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID tahun ajar wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();

		// Set semua is_aktif = false dulu
		await supabase.from('tahun_ajar').update({ is_aktif: false }).neq('id', '');

		// Set yang dipilih = true
		const { error } = await supabase.from('tahun_ajar').update({ is_aktif: true }).eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true, message: `Periode berhasil diaktifkan` });
	} catch (error) {
		console.error('PATCH tahun_ajar/aktif error:', error);
		return NextResponse.json({ error: 'Gagal mengaktifkan periode' }, { status: 500 });
	}
}
