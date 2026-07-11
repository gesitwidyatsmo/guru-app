import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const generateId = () => Math.random().toString(36).slice(2, 11);
const normDate = (v) => String(v ?? '').slice(0, 10);

// GET:
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const jam_ke = searchParams.get('jam_ke');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');

		if (!kelas || !mapel) {
			return NextResponse.json({ error: 'Parameter kelas & mapel wajib' }, { status: 400 });
		}

		const supabase = await createClient();
		let query = supabase.from('absensi_mapel').select('sesi_id, guru_id, tanggal, jam_ke, kelas, mapel').eq('kelas', kelas).eq('mapel', mapel);

		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		if (bulan && tahun) {
			const startDate = new Date(tahun, bulan - 1, 1).toISOString();
			const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString();
			query = query.gte('tanggal', startDate).lte('tanggal', endDate);
		}

		if (tanggal && jam_ke) {
			query = query.eq('tanggal', tanggal).eq('jam_ke', jam_ke);
			const { data: sesiData, error: sesiError } = await query.single();

			if (sesiError || !sesiData) return NextResponse.json([]);

			const { data: detailData, error: detailError } = await supabase
				.from('absensi_mapel_siswa')
				.select('siswa_id, status, keterangan')
				.eq('sesi_id', sesiData.sesi_id);

			if (detailError) throw detailError;
			
			// Map id_row to support frontend's old format
			const mappedData = (detailData || []).map(d => ({ ...d, id_row: sesiData.sesi_id }));
			return NextResponse.json(mappedData);
		}

		const { data: sessions, error } = await query;
		if (error) throw error;

		const pertemuan = (sessions || []).map((r) => ({
			id: r.sesi_id,
			guru_id: r.guru_id || '',
			tanggal: normDate(r.tanggal),
			jam_ke: r.jam_ke,
			kelas: r.kelas,
			mapel: r.mapel,
			data_absensi: '[]',
		}));

		pertemuan.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
		return NextResponse.json(pertemuan);
	} catch (error) {
		console.error('GET /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// POST upsert
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		const role = req.headers.get('x-user-role');

		const body = await req.json();
		const oldTanggal = body.oldTanggal || body.tanggal;
		const newTanggal = body.newTanggal || body.tanggal;
		const oldJamKe = body.oldJam_ke || body.jam_ke;
		const newJamKe = body.newJam_ke || body.jam_ke;
		const { kelas, mapel } = body;
		const data_absensi = body.absensiList || body.data;

		if (!oldTanggal || !oldJamKe || !kelas || !mapel) {
			return NextResponse.json({ error: 'parameter wajib tidak lengkap' }, { status: 400 });
		}

		const supabase = await createClient();
		let query = supabase.from('absensi_mapel')
			.select('sesi_id')
			.eq('kelas', kelas)
			.eq('mapel', mapel)
			.eq('tanggal', oldTanggal)
			.eq('jam_ke', oldJamKe);

		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		const { data: existingSesi } = await query.single();
		let sesiId = existingSesi ? existingSesi.sesi_id : `SESI-M-${generateId()}`;

		if (existingSesi) {
			const updates = {};
			if (oldTanggal !== newTanggal) updates.tanggal = newTanggal;
			if (oldJamKe !== newJamKe) updates.jam_ke = newJamKe;
			
			if (Object.keys(updates).length > 0) {
				await supabase.from('absensi_mapel').update(updates).eq('sesi_id', sesiId);
			}
			await supabase.from('absensi_mapel_siswa').delete().eq('sesi_id', sesiId);
		} else {
			await supabase.from('absensi_mapel').insert({
				sesi_id: sesiId,
				guru_id: userId || null,
				tanggal: newTanggal,
				jam_ke: newJamKe,
				kelas: kelas,
				mapel: mapel
			});
		}

		if (data_absensi && data_absensi.length > 0) {
			const rowsToInsert = data_absensi.map(item => ({
				sesi_id: sesiId,
				siswa_id: item.siswa_id,
				status: item.status,
				keterangan: item.keterangan || ''
			}));
			await supabase.from('absensi_mapel_siswa').insert(rowsToInsert);
		}

		return NextResponse.json({ success: true, id: sesiId, mode: existingSesi ? 'update' : 'insert' });
	} catch (error) {
		console.error('POST /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// DELETE: Hapus sesi
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const jam_ke = searchParams.get('jam_ke');

		if (!kelas || !mapel || !tanggal || !jam_ke) {
			return NextResponse.json({ error: 'parameter kurang' }, { status: 400 });
		}

		const supabase = await createClient();
		let query = supabase.from('absensi_mapel')
			.delete()
			.eq('kelas', kelas)
			.eq('mapel', mapel)
			.eq('tanggal', tanggal)
			.eq('jam_ke', jam_ke);

		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		const { data: deleted, error } = await query.select();

		if (error) throw error;
		if (!deleted || deleted.length === 0) {
			return NextResponse.json({ error: 'Data absensi tidak ditemukan / Akses Ditolak' }, { status: 403 });
		}

		return NextResponse.json({ success: true, deleted: deleted.length });
	} catch (error) {
		console.error('DELETE /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
