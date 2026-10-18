import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

// Normalisasi status presensi agar konsisten (Alpa, Alfa, Alpha, A)
const normStatus = (val) => {
	const s = String(val || '').trim().toLowerCase();
	if (s === 'hadir' || s === 'h') return 'hadir';
	if (s === 'sakit' || s === 's') return 'sakit';
	if (s === 'izin' || s === 'i') return 'izin';
	if (s === 'alfa' || s === 'alpa' || s === 'alpha' || s === 'a') return 'alfa';
	return s;
};

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const tanggal = searchParams.get('tanggal') || new Date().toISOString().slice(0, 10);
		const filterKelas = searchParams.get('kelas');

		const supabase = await createClient();

		// 1. Ambil seluruh siswa aktif
		let siswaQuery = supabaseAdmin
			.from('siswa')
			.select('id, nis, nama_lengkap, kelas, jenis_kelamin, status')
			.eq('status', 'Aktif')
			.order('kelas', { ascending: true })
			.order('nama_lengkap', { ascending: true });

		if (filterKelas && filterKelas !== 'Semua') {
			siswaQuery = siswaQuery.eq('kelas', filterKelas);
		}

		const { data: siswaListRaw, error: errSiswa } = await siswaQuery;
		if (errSiswa) throw errSiswa;
		const siswaList = siswaListRaw || [];

		// 2. Ambil sesi absensi_harian pada tanggal tersebut
		let harianQuery = supabaseAdmin
			.from('absensi_harian')
			.select(`
				sesi_id,
				tanggal,
				kelas,
				absensi_harian_siswa (
					siswa_id,
					status,
					keterangan
				)
			`)
			.eq('tanggal', tanggal);

		if (filterKelas && filterKelas !== 'Semua') {
			harianQuery = harianQuery.eq('kelas', filterKelas);
		}

		const { data: sesiHarianRaw } = await harianQuery;
		const sesiHarianList = sesiHarianRaw || [];

		// Map harian per siswa: siswa_id -> { status, keterangan }
		const harianMap = new Map();
		sesiHarianList.forEach((sesi) => {
			(sesi.absensi_harian_siswa || []).forEach((row) => {
				harianMap.set(String(row.siswa_id), {
					status: row.status,
					keterangan: row.keterangan,
					kelas: sesi.kelas,
				});
			});
		});

		// 3. Ambil seluruh sesi absensi_mapel pada tanggal tersebut
		let mapelQuery = supabaseAdmin
			.from('absensi_mapel')
			.select(`
				sesi_id,
				guru_id,
				tanggal,
				jam_ke,
				kelas,
				mapel,
				users:guru_id (nama_lengkap),
				absensi_mapel_siswa (
					siswa_id,
					status,
					keterangan
				)
			`)
			.eq('tanggal', tanggal)
			.order('jam_ke', { ascending: true });

		if (filterKelas && filterKelas !== 'Semua') {
			mapelQuery = mapelQuery.eq('kelas', filterKelas);
		}

		const { data: sesiMapelRaw } = await mapelQuery;
		const sesiMapelList = sesiMapelRaw || [];

		// Map mapel per siswa: siswa_id -> Array<{ jam_ke, mapel, guru, status, keterangan }>
		const mapelSessionsPerStudent = new Map();
		sesiMapelList.forEach((sesi) => {
			const guruNama = sesi.users?.nama_lengkap || 'Guru Pengajar';
			(sesi.absensi_mapel_siswa || []).forEach((row) => {
				const sid = String(row.siswa_id);
				if (!mapelSessionsPerStudent.has(sid)) {
					mapelSessionsPerStudent.set(sid, []);
				}
				mapelSessionsPerStudent.get(sid).push({
					sesi_id: sesi.sesi_id,
					jam_ke: sesi.jam_ke,
					mapel: sesi.mapel,
					guru: guruNama,
					status: (row.status || '').trim(),
					keterangan: row.keterangan || '',
				});
			});
		});

		// 4. ALGORITMA AUDIT & DETEKSI RADAR BOLOS (BERBASIS SESI KBM / MAPEL RIIL)
		const radarBolosList = [];
		const siswaDetailList = [];

		let totalHadirPenuh = 0;
		let totalHadirSebagian = 0;
		let totalAlfaSepanjangKbm = 0;
		let totalSakitCount = 0;
		let totalIzinCount = 0;
		let totalCabutSiang = 0;
		let totalBolosAwal = 0;
		let totalBolosTengah = 0;
		let totalSiagaPagi = 0;

		siswaList.forEach((siswa) => {
			const sid = String(siswa.id);
			const harian = harianMap.get(sid);
			const sessions = mapelSessionsPerStudent.get(sid) || [];

			let hadirCount = 0;
			let sakitCount = 0;
			let izinCount = 0;
			let alfaCount = 0;

			sessions.forEach((s) => {
				const st = normStatus(s.status);
				if (st === 'hadir') hadirCount++;
				else if (st === 'sakit') sakitCount++;
				else if (st === 'izin') izinCount++;
				else if (st === 'alfa') alfaCount++;
			});

			const missedSessions = sessions.filter(
				(s) => normStatus(s.status) === 'alfa'
			);

			// Klasifikasi status kehadiran KBM harian siswa
			let statusKbm = 'Belum Ada Data KBM';
			if (sessions.length > 0) {
				if (hadirCount === sessions.length) {
					statusKbm = 'Hadir Penuh';
					totalHadirPenuh++;
				} else if (hadirCount > 0) {
					statusKbm = `Hadir ${hadirCount}/${sessions.length} Sesi`;
					totalHadirSebagian++;
				} else if (sakitCount > 0) {
					statusKbm = 'Sakit';
					totalSakitCount++;
				} else if (izinCount > 0) {
					statusKbm = 'Izin';
					totalIzinCount++;
				} else {
					statusKbm = `Alfa (${alfaCount} Sesi)`;
					totalAlfaSepanjangKbm++;
				}
			}

			// DETEKSI POLA BOLOS, CABUT, DAN SIAGA PAGI
			let isDeteksi = false;
			let tipeTemuan = '';
			let labelTipe = '';
			let badgeColor = '';
			let urgensi = 'Sedang';
			let deskripsiTemuan = '';

			if (sessions.length > 0 && alfaCount > 0) {
				const firstSession = sessions[0];
				const lastSession = sessions[sessions.length - 1];
				const isFirstAlfa = normStatus(firstSession.status) === 'alfa';
				const isLastAlfa = normStatus(lastSession.status) === 'alfa';
				const isFirstHadir = normStatus(firstSession.status) === 'hadir';
				const isLastHadir = normStatus(lastSession.status) === 'hadir';

				if (hadirCount > 0) {
					// Kasus Campuran (Pasti Bolos Jam Pelajaran)
					isDeteksi = true;

					if (isFirstAlfa && isLastHadir) {
						// 1. Bolos Masuk Siang / Telat Pagi (Alfa jam 1-2 tapi jam siang hadir)
						tipeTemuan = 'BOLOS_AWAL';
						labelTipe = 'Bolos Jam Awal (Masuk Siang)';
						badgeColor = 'bg-amber-500 text-white';
						urgensi = 'Sedang';
						deskripsiTemuan = 'Santri tidak mengikuti jam awal, namun hadir di jam berikutnya.';
						totalBolosAwal++;
					} else if (isFirstHadir && isLastAlfa) {
						// 2. Cabut Siang / Jam Akhir (Hadir jam awal, kabur jam siang)
						tipeTemuan = 'CABUT_SIANG';
						labelTipe = 'Bolos Cabut Jam Siang';
						badgeColor = 'bg-rose-600 text-white';
						urgensi = 'Tinggi';
						deskripsiTemuan = 'Santri hadir di awal KBM, namun meninggalkan/cabut di jam siang.';
						totalCabutSiang++;
					} else if (isFirstHadir && isLastHadir) {
						// 3. Bolos Jam Tengah (Pilih-pilih Mapel tertentu)
						tipeTemuan = 'BOLOS_TENGAH';
						labelTipe = 'Bolos Jam Tengah (Pilih Mapel)';
						badgeColor = 'bg-purple-600 text-white';
						urgensi = 'Tinggi';
						deskripsiTemuan = 'Santri sengaja meninggalkan pelajaran tertentu di jam tengah.';
						totalBolosTengah++;
					} else {
						// Pola campuran lainnya
						tipeTemuan = 'CABUT_SIANG';
						labelTipe = 'Bolos Sebagian Jam KBM';
						badgeColor = 'bg-rose-500 text-white';
						urgensi = 'Tinggi';
						deskripsiTemuan = 'Santri tidak mengikuti beberapa sesi KBM yang terjadwal.';
						totalCabutSiang++;
					}
				} else {
					// hadirCount === 0 (Belum ada sesi yang dihadiri sama sekali)
					if (sessions.length === 1) {
						// 4. SIAGA PAGI: Baru jam pertama yang diinput guru, santri langsung ALFA!
						isDeteksi = true;
						tipeTemuan = 'SIAGA_PAGI';
						labelTipe = '🚨 Siaga Pagi (Alfa Jam Pertama)';
						badgeColor = 'bg-red-600 text-white animate-pulse';
						urgensi = 'Kritis';
						deskripsiTemuan = 'Santri langsung alfa di jam pelajaran pertama. Perlu segera dicek ke asrama/kamar.';
						totalSiagaPagi++;
					} else if (sessions.length > 1) {
						// 5. ALFA SEPANJANG KBM: Seluruh jam yang diinput hari ini Alfa
						isDeteksi = true;
						tipeTemuan = 'ALFA_TOTAL';
						labelTipe = '⛔ Alfa Sepanjang KBM';
						badgeColor = 'bg-gray-800 text-white';
						urgensi = 'Perhatian';
						deskripsiTemuan = 'Santri tidak hadir di semua sesi mata pelajaran hari ini.';
					}
				}
			}

			if (isDeteksi) {
				radarBolosList.push({
					siswa_id: siswa.id,
					nama_lengkap: siswa.nama_lengkap,
					nis: siswa.nis,
					kelas: siswa.kelas,
					jenis_kelamin: siswa.jenis_kelamin,
					tipe_temuan: tipeTemuan,
					label_tipe: labelTipe,
					badge_color: badgeColor,
					urgensi,
					deskripsi_temuan: deskripsiTemuan,
					status_kbm: statusKbm,
					status_harian: harian?.status || statusKbm,
					total_sesi: sessions.length,
					sesi_hadir: hadirCount,
					sesi_bolos: missedSessions.length,
					jam_bolos_list: missedSessions.map((m) => `Jam ${m.jam_ke} (${m.mapel})`),
					detail_sesi_bolos: missedSessions,
					semua_sesi: sessions,
				});
			}

			siswaDetailList.push({
				id: siswa.id,
				nama_lengkap: siswa.nama_lengkap,
				nis: siswa.nis,
				kelas: siswa.kelas,
				status_kbm: statusKbm,
				isBolos: isDeteksi,
				tipe_temuan: tipeTemuan,
				total_sesi: sessions.length,
				sesi_hadir: hadirCount,
				sesi_alfa: alfaCount,
			});
		});

		// 5. REKAPITULASI KEHADIRAN PER KELAS HARI INI
		const kelasAggMap = new Map();
		siswaList.forEach((s) => {
			if (!kelasAggMap.has(s.kelas)) {
				kelasAggMap.set(s.kelas, {
					kelas: s.kelas,
					totalSiswa: 0,
					hadir: 0,
					sakit: 0,
					izin: 0,
					alfa: 0,
					bolosCabut: 0,
				});
			}
			const agg = kelasAggMap.get(s.kelas);
			agg.totalSiswa++;
		});

		siswaDetailList.forEach((s) => {
			const agg = kelasAggMap.get(s.kelas);
			if (agg) {
				const st = (s.status_kbm || '').toLowerCase();
				if (st.includes('hadir')) agg.hadir++;
				else if (st === 'sakit') agg.sakit++;
				else if (st === 'izin') agg.izin++;
				else if (st.includes('alfa')) agg.alfa++;
				if (s.isBolos) agg.bolosCabut++;
			}
		});

		const rekapKelas = Array.from(kelasAggMap.values()).map((k) => ({
			...k,
			persenHadir: k.totalSiswa > 0 ? Math.round((k.hadir / k.totalSiswa) * 100) : 0,
		}));

		// 6. DETEKSI SISWA ALFA KRONIS (≥ 3 Hari Alfa dalam 14 hari terakhir)
		// Menggabungkan data dari absensi_mapel_siswa dan absensi_harian_siswa
		const twoWeeksAgo = new Date();
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
		const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

		// Ambil dari sesi mapel (sumber utama KBM)
		const { data: kronisMapelRows } = await supabaseAdmin
			.from('absensi_mapel_siswa')
			.select(`
				siswa_id,
				status,
				absensi_mapel!inner (
					tanggal,
					kelas
				)
			`)
			.or('status.ilike.alfa%,status.ilike.alpa%,status.ilike.alpha%,status.eq.A,status.eq.a')
			.gte('absensi_mapel.tanggal', twoWeeksAgoStr);

		// Ambil juga dari absensi harian jika ada
		const { data: kronisHarianRows } = await supabaseAdmin
			.from('absensi_harian_siswa')
			.select(`
				siswa_id,
				status,
				absensi_harian!inner (
					tanggal,
					kelas
				)
			`)
			.or('status.ilike.alfa%,status.ilike.alpa%,status.ilike.alpha%,status.eq.A,status.eq.a')
			.gte('absensi_harian.tanggal', twoWeeksAgoStr);

		// Hitung tanggal unik (hari) di mana santri tercatat alfa
		const studentAlfaDatesMap = new Map();
		(kronisMapelRows || []).forEach((row) => {
			const sid = String(row.siswa_id);
			const tgl = row.absensi_mapel?.tanggal;
			if (!studentAlfaDatesMap.has(sid)) studentAlfaDatesMap.set(sid, new Set());
			if (tgl) studentAlfaDatesMap.get(sid).add(tgl);
		});
		(kronisHarianRows || []).forEach((row) => {
			const sid = String(row.siswa_id);
			const tgl = row.absensi_harian?.tanggal;
			if (!studentAlfaDatesMap.has(sid)) studentAlfaDatesMap.set(sid, new Set());
			if (tgl) studentAlfaDatesMap.get(sid).add(tgl);
		});

		const siswaMapLookup = new Map(siswaList.map((s) => [String(s.id), s]));
		const siswaKronisList = Array.from(studentAlfaDatesMap.entries())
			.map(([sid, dateSet]) => ({
				sid,
				count: dateSet.size,
			}))
			.filter((item) => item.count >= 3)
			.map(({ sid, count }) => {
				const s = siswaMapLookup.get(sid) || {
					nama_lengkap: `Siswa #${sid}`,
					nis: '—',
					kelas: '—',
				};
				return {
					siswa_id: sid,
					nama_lengkap: s.nama_lengkap,
					nis: s.nis,
					kelas: s.kelas,
					total_alfa_14_hari: count,
					status_peringatan: count >= 5 ? 'Kritis (Panggil Orang Tua)' : 'Perlu Perhatian',
				};
			})
			.sort((a, b) => b.total_alfa_14_hari - a.total_alfa_14_hari);

		return NextResponse.json({
			tanggal,
			totalSiswa: siswaList.length,
			summary: {
				hadir: totalHadirPenuh + totalHadirSebagian,
				hadirPenuh: totalHadirPenuh,
				hadirSebagian: totalHadirSebagian,
				sakit: totalSakitCount,
				izin: totalIzinCount,
				alfa: totalAlfaSepanjangKbm,
				bolosCabut: totalCabutSiang,
				bolosAwal: totalBolosAwal,
				bolosTengah: totalBolosTengah,
				siagaPagi: totalSiagaPagi,
				totalTemuan: radarBolosList.length,
				persenHadirSekolah:
					siswaList.length > 0
						? Math.round(((totalHadirPenuh + totalHadirSebagian) / siswaList.length) * 100)
						: 0,
			},
			radarBolos: radarBolosList,
			radarKronis: siswaKronisList,
			rekapKelas,
			totalSesiMapelTerekam: sesiMapelList.length,
			totalSesiHarianTerekam: sesiHarianList.length,
		});
	} catch (err) {
		console.error('GET /api/kesiswaan/radar-bolos error:', err);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}
