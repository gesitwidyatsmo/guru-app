import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { verifyGeofence } from '@/lib/geofenceServer';

const generateId = () => Math.random().toString(36).slice(2, 11);
const normDate = (v) => String(v ?? '').slice(0, 10);

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

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

		if (!kelas) {
			return NextResponse.json({ error: 'Parameter kelas wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Guru' && userId) {
			const { data: kbmData } = await supabase.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId);
			const allowedClasses = (kbmData || []).map(r => r.nama_kelas);
			
			if (!allowedClasses.includes(kelas)) {
				return NextResponse.json([]); // Cegah pengintipan kelas lain
			}
		}

		let query = supabase.from('absensi_harian').select('sesi_id, tanggal, kelas').eq('kelas', kelas);

		// Filter Periode Akademik
		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester));

		// Filter bulan & tahun
		if (bulan && tahun) {
			const b = parseInt(bulan, 10);
			const y = parseInt(tahun, 10);
			const startDate = `${y}-${String(b).padStart(2, '0')}-01`;
			const lastDay = new Date(y, b, 0).getDate();
			const endDate = `${y}-${String(b).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
			query = query.gte('tanggal', startDate).lte('tanggal', endDate);
		}

		// Detail mode (tanggal spesifik)
		if (tanggal) {
			query = query.eq('tanggal', tanggal);
			const { data: sesiData, error: sesiError } = await query.single();

			if (sesiError || !sesiData) return NextResponse.json([]); // belum ada pertemuan

			// Ambil detail siswa
			const { data: detailData, error: detailError } = await supabase
				.from('absensi_harian_siswa')
				.select('siswa_id, status, keterangan')
				.eq('sesi_id', sesiData.sesi_id);

			if (detailError) throw detailError;
			return NextResponse.json(detailData || []);
		}

		// List mode
		const { data: sessions, error } = await query;
		if (error) throw error;

		let allDetails = [];
		if (sessions && sessions.length > 0) {
			const sesiIds = sessions.map(s => s.sesi_id);
			const { data: detailData, error: detailError } = await supabase
				.from('absensi_harian_siswa')
				.select('sesi_id, siswa_id, status, keterangan')
				.in('sesi_id', sesiIds);
			
			if (!detailError && detailData) {
				allDetails = detailData;
			}
		}

		const pertemuan = (sessions || []).map((r) => {
			const detailsForSession = allDetails.filter(d => d.sesi_id === r.sesi_id);
			return {
				id: r.sesi_id,
				tanggal: normDate(r.tanggal),
				kelas: r.kelas,
				data_absensi: detailsForSession, 
			};
		});

		pertemuan.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		return NextResponse.json(pertemuan);
	} catch (error) {
		console.error('Error GET absensi harian:', error);
		return NextResponse.json({ error: error?.message || 'Terjadi kesalahan' }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const oldTanggal = body.oldTanggal || body.tanggal;
		const newTanggal = body.newTanggal || body.tanggal;
		const kelas = body.kelas;
		const data_absensi = body.absensiList || body.data;

		if (!oldTanggal || !newTanggal || !kelas || !Array.isArray(data_absensi)) {
			return NextResponse.json({ error: 'Payload tidak lengkap' }, { status: 400 });
		}

		if (data_absensi.length === 0) {
			return NextResponse.json({ error: 'Data absensi siswa tidak boleh kosong' }, { status: 400 });
		}

		const supabase = await createClient();
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}

		// Verifikasi Geofence jika diaktifkan oleh Admin
		const geoCheck = await verifyGeofence({
			supabase,
			userLat: body.user_lat,
			userLng: body.user_lng,
			moduleName: 'absensi',
			role,
		});

		if (!geoCheck.allowed) {
			return NextResponse.json({ error: geoCheck.error }, { status: geoCheck.status || 403 });
		}

		const userId = req.headers.get('x-user-id');

		if (role === 'Guru') {
			const { data: kelasData } = await supabase.from('kelas').select('id_wali_kelas').eq('nama_kelas', kelas).single();
			if (!kelasData || kelasData.id_wali_kelas !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Khusus Wali Kelas berwenang atas log absensi harian ini.' }, { status: 403 });
			}
		}

		// Check existing
		const { data: existingSesi, error: findSesiErr } = await supabase
			.from('absensi_harian')
			.select('sesi_id')
			.eq('kelas', kelas)
			.eq('tanggal', oldTanggal)
			.maybeSingle();

		if (findSesiErr) throw findSesiErr;

		let sesiId = existingSesi ? existingSesi.sesi_id : `SESI-H-${generateId()}`;

		if (existingSesi) {
			if (oldTanggal !== newTanggal) {
				const { error: updErr } = await supabase.from('absensi_harian').update({ tanggal: newTanggal }).eq('sesi_id', sesiId);
				if (updErr) throw updErr;
			}
			// Delete old details
			const { error: delErr } = await supabase.from('absensi_harian_siswa').delete().eq('sesi_id', sesiId);
			if (delErr) throw delErr;
		} else {
			// Gunakan tahun ajar dari body; jika tidak ada, ambil yang aktif dari DB
			const taAktif = (!body.tahun_ajar || !body.semester) ? await getTAAktif(supabase) : null;
			const { error: insHarianErr } = await supabase.from('absensi_harian').insert({
				sesi_id: sesiId,
				kelas: kelas,
				tanggal: newTanggal,
				tahun_ajar: body.tahun_ajar || taAktif.nama,
				semester: body.semester ? parseInt(body.semester) : taAktif.semester,
			});
			if (insHarianErr) throw insHarianErr;
		}

		// Insert new details
		const rowsToInsert = data_absensi.map(item => ({
			sesi_id: sesiId,
			siswa_id: item.siswa_id,
			status: item.status,
			keterangan: item.keterangan || ''
		}));
		const { error: insDetailsErr } = await supabase.from('absensi_harian_siswa').insert(rowsToInsert);
		if (insDetailsErr) throw insDetailsErr;

		return NextResponse.json({ 
			success: true, 
			id: sesiId, 
			mode: existingSesi ? 'update' : 'insert', 
			message: `Sesi absensi ${existingSesi ? 'diperbarui' : 'dibuat'}` 
		}, { status: existingSesi ? 200 : 201 });
	} catch (error) {
		console.error('Error POST absensi harian:', error);
		return NextResponse.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 });
	}
}

export async function PUT(req) {
	return POST(req);
}

export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');

		if (!kelas || !tanggal) {
			return NextResponse.json({ error: 'parameter kelas dan tanggal diperlukan' }, { status: 400 });
		}

		const supabase = await createClient();
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}
		const userId = req.headers.get('x-user-id');

		if (role === 'Guru') {
			const { data: kelasData } = await supabase.from('kelas').select('id_wali_kelas').eq('nama_kelas', kelas).single();
			if (!kelasData || kelasData.id_wali_kelas !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Penghapusan catatan absensi harian hanya bisa dilakukan Wali Kelas yurisdiksi ini.' }, { status: 403 });
			}
		}

		const { data: deleted, error } = await supabase
			.from('absensi_harian')
			.delete()
			.eq('kelas', kelas)
			.eq('tanggal', tanggal)
			.select();

		if (error) throw error;

		return NextResponse.json({ success: true, message: `${deleted?.length || 0} sesi absen telah dihapus` }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE absensi:', error);
		return NextResponse.json({ error: error?.message || 'Gagal menghapus absensi' }, { status: 500 });
	}
}
