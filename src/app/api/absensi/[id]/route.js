import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(req, context) {
	try {
		const params = await context.params;
		const { id } = params;
		const body = await req.json();

		if (!id) {
			return NextResponse.json({ error: 'ID tidak ditemukan' }, { status: 400 });
		}

		if (!body.status) {
			return NextResponse.json({ error: 'Status wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Guru') {
			// Get sesi_id of this record
			const { data: recordData } = await supabase.from('absensi_harian_siswa').select('sesi_id').eq('id', id).single();
			if (recordData) {
				const { data: sesiData } = await supabase.from('absensi_harian').select('kelas').eq('sesi_id', recordData.sesi_id).single();
				if (sesiData) {
					const { data: kelasData } = await supabase.from('kelas').select('id_wali_kelas').eq('nama_kelas', sesiData.kelas).single();
					if (!kelasData || kelasData.id_wali_kelas !== userId) {
						return NextResponse.json({ error: 'Akses Ditolak: Anda bukan wali kelas.' }, { status: 403 });
					}
				}
			}
		}

		const { data, error } = await supabase
			.from('absensi_harian_siswa')
			.update({
				status: body.status,
				keterangan: body.keterangan || '',
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			return NextResponse.json({ error: 'Data absensi tidak ditemukan', details: error.message }, { status: 404 });
		}

		return NextResponse.json(
			{
				success: true,
				data: {
					id: data.id,
					status: data.status,
					keterangan: data.keterangan,
				},
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('❌ Error PUT absensi [id]:', error);
		return NextResponse.json(
			{
				error: error?.message || 'Terjadi kesalahan server',
			},
			{ status: 500 }
		);
	}
}
