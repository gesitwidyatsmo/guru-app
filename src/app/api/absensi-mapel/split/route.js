import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { findConflictingSession, parseJamPelajaran } from '@/lib/absensiUtils';
import { verifyGeofence } from '@/lib/geofenceServer';

const generateId = () => Math.random().toString(36).slice(2, 11);

export async function POST(req) {
	try {
		const supabase = await createClient();

		// Dapatkan profil user saat ini
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
		}

		const { data: profile } = await supabase
			.from('users')
			.select('id_user, role')
			.eq('auth_id', user.id)
			.single();

		const role = profile?.role || req.headers.get('x-user-role');
		const userId = profile?.id_user || req.headers.get('x-user-id');

		if (role === 'Kepala Sekolah') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' },
				{ status: 403 }
			);
		}

		const body = await req.json();
		const {
			kelas,
			mapel,
			tanggal,
			original_jam_ke,
			sesi_1_jam,
			sesi_2_jam,
			siswa_alfa_ids = [],
			status_alfa = 'Alpa',
			keterangan_alfa = '',
			tahun_ajar,
			semester,
			user_lat,
			user_lng,
		} = body;

		if (!kelas || !mapel || !tanggal || !original_jam_ke || !sesi_1_jam || !sesi_2_jam) {
			return NextResponse.json(
				{ error: 'Parameter wajib tidak lengkap (kelas, mapel, tanggal, original_jam_ke, sesi_1_jam, sesi_2_jam)' },
				{ status: 400 }
			);
		}

		// Verifikasi Geofence jika diaktifkan
		const geoCheck = await verifyGeofence({
			supabase,
			userLat: user_lat,
			userLng: user_lng,
			userAccuracy: body.user_accuracy,
			moduleName: 'absensi',
			role,
		});

		if (!geoCheck.allowed) {
			return NextResponse.json({ error: geoCheck.error }, { status: geoCheck.status || 403 });
		}

		// 1. Temukan sesi asli di database
		let queryOriginal = supabase
			.from('absensi_mapel')
			.select('sesi_id, guru_id, tanggal, jam_ke, kelas, mapel, tahun_ajar, semester')
			.eq('kelas', kelas)
			.eq('mapel', mapel)
			.eq('tanggal', tanggal)
			.eq('jam_ke', original_jam_ke);

		if (role === 'Guru' && userId) {
			queryOriginal = queryOriginal.eq('guru_id', userId);
		}

		const { data: originalList, error: origErr } = await queryOriginal;
		if (origErr || !originalList || originalList.length === 0) {
			return NextResponse.json(
				{ error: 'Sesi asli tidak ditemukan atau Anda tidak memiliki akses untuk mengubahnya.' },
				{ status: 404 }
			);
		}

		const originalSesi = originalList[0];

		// 2. Ambil seluruh sesi yang ada hari ini di kelas ini untuk mendeteksi potensi bentrok
		const { data: allSessionsToday } = await supabase
			.from('absensi_mapel')
			.select('sesi_id, jam_ke, mapel, users(nama_lengkap)')
			.eq('kelas', kelas)
			.eq('tanggal', tanggal);

		// Abaikan originalSesi saat cek konflik sesi_1_jam dan sesi_2_jam
		const conflict1 = findConflictingSession(allSessionsToday || [], sesi_1_jam, originalSesi.sesi_id);
		if (conflict1) {
			const teacher1 = conflict1.session.users?.nama_lengkap || 'Guru';
			return NextResponse.json(
				{ error: `Konflik Jam: Sesi 1 (Jam ${sesi_1_jam}) bertabrakan dengan sesi ${conflict1.session.mapel || 'mapel lain'} (${teacher1}) pada Jam ${conflict1.session.jam_ke}.` },
				{ status: 409 }
			);
		}

		const conflict2 = findConflictingSession(allSessionsToday || [], sesi_2_jam, originalSesi.sesi_id);
		if (conflict2) {
			const teacher2 = conflict2.session.users?.nama_lengkap || 'Guru';
			return NextResponse.json(
				{ error: `Konflik Jam: Sesi 2 (Jam ${sesi_2_jam}) bertabrakan dengan sesi ${conflict2.session.mapel || 'mapel lain'} (${teacher2}) pada Jam ${conflict2.session.jam_ke}.` },
				{ status: 409 }
			);
		}

		// 3. Ambil data siswa yang tersimpan di sesi asli
		const { data: originalDetails, error: detailErr } = await supabase
			.from('absensi_mapel_siswa')
			.select('siswa_id, status, keterangan')
			.eq('sesi_id', originalSesi.sesi_id);

		if (detailErr) {
			throw detailErr;
		}

		// 4. Update sesi asli: ubah jam_ke menjadi sesi_1_jam (Sesi 1)
		// Data siswa di sesi 1 tetap hadir (karena di jam pertama siswa masih hadir di kelas)
		const { error: updateOrigErr } = await supabase
			.from('absensi_mapel')
			.update({ jam_ke: sesi_1_jam })
			.eq('sesi_id', originalSesi.sesi_id);

		if (updateOrigErr) {
			throw updateOrigErr;
		}

		// 5. Buat sesi baru untuk Sesi 2 (Jam ke-2 atau jam keluar)
		const newSesiId = `SESI-M-${generateId()}`;
		const finalTA = tahun_ajar || originalSesi.tahun_ajar;
		const finalSemester = semester ? parseInt(semester) : originalSesi.semester;

		const { error: insertSesiErr } = await supabase
			.from('absensi_mapel')
			.insert({
				sesi_id: newSesiId,
				guru_id: originalSesi.guru_id || userId,
				tanggal: originalSesi.tanggal,
				jam_ke: sesi_2_jam,
				kelas: originalSesi.kelas,
				mapel: originalSesi.mapel,
				tahun_ajar: finalTA,
				semester: finalSemester,
			});

		if (insertSesiErr) {
			// Rollback jam_ke sesi 1 jika insert sesi 2 gagal
			await supabase.from('absensi_mapel').update({ jam_ke: original_jam_ke }).eq('sesi_id', originalSesi.sesi_id);
			throw insertSesiErr;
		}

		// 6. Buat rincian absensi siswa untuk Sesi 2:
		// - Siswa yang keluar (ada di siswa_alfa_ids): status = status_alfa (Alfa) & keterangan kustom
		// - Siswa yang tetap di kelas: status & keterangan sama seperti di sesi 1
		const newDetails = (originalDetails || []).map((d) => {
			const isLeft = siswa_alfa_ids.map(String).includes(String(d.siswa_id));
			if (isLeft) {
				return {
					sesi_id: newSesiId,
					siswa_id: d.siswa_id,
					status: status_alfa || 'Alpa',
					keterangan: keterangan_alfa || `Meninggalkan kelas / keluar di jam ke-${parseJamPelajaran(sesi_2_jam)[0] || sesi_2_jam}`,
				};
			}
			return {
				sesi_id: newSesiId,
				siswa_id: d.siswa_id,
				status: d.status || 'Hadir',
				keterangan: d.keterangan || '',
			};
		});

		if (newDetails.length > 0) {
			const { error: insertDetailsErr } = await supabase
				.from('absensi_mapel_siswa')
				.insert(newDetails);

			if (insertDetailsErr) {
				console.error('Error insert newDetails for split session:', insertDetailsErr);
				// Bersihkan sesi 2 jika detail gagal
				await supabase.from('absensi_mapel').delete().eq('sesi_id', newSesiId);
				await supabase.from('absensi_mapel').update({ jam_ke: original_jam_ke }).eq('sesi_id', originalSesi.sesi_id);
				throw insertDetailsErr;
			}
		}

		return NextResponse.json({
			success: true,
			message: `Berhasil memecah sesi Jam ${original_jam_ke} menjadi Jam ${sesi_1_jam} dan Jam ${sesi_2_jam}`,
			original_sesi_id: originalSesi.sesi_id,
			new_sesi_id: newSesiId,
			sesi_1_jam,
			sesi_2_jam,
			count_siswa_alfa: siswa_alfa_ids.length,
		});
	} catch (error) {
		console.error('POST /api/absensi-mapel/split Error:', error);
		return NextResponse.json(
			{ error: error.message || 'Terjadi kesalahan server saat memecah sesi absensi' },
			{ status: 500 }
		);
	}
}
