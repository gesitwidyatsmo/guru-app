import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { konversiPoinKeSikap } from '@/lib/poinUtils';

async function getAuthInfo(request, supabase) {
	const cookieStore = await cookies();
	let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
	let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;

	if (!role || !userId) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: userProfile } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('auth_id', user.id)
				.maybeSingle();
			if (userProfile) {
				role = role || userProfile.role;
				userId = userId || userProfile.id_user;
			}
		}
	}

	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { searchParams } = new URL(request.url);

		const kelasId = searchParams.get('kelas_id');
		const tahunAjaran = searchParams.get('tahun_ajaran') || '2026/2027';

		if (!kelasId) {
			return NextResponse.json({ error: 'kelas_id wajib disertakan' }, { status: 400 });
		}

		// 1. Ambil data Kelas & Siswa
		const { data: klsData, error: klsErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas, tingkat')
			.eq('id', kelasId)
			.single();

		if (klsErr || !klsData) {
			return NextResponse.json({ error: 'Data kelas tidak ditemukan' }, { status: 404 });
		}

		const { data: siswaList, error: sErr } = await supabase
			.from('siswa')
			.select('id, nama_lengkap, nis, nisn, kelas')
			.eq('kelas', klsData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });

		if (sErr || !siswaList) {
			return NextResponse.json({ error: 'Data siswa tidak ditemukan' }, { status: 404 });
		}

		const siswaIds = siswaList.map((s) => s.id);

		// 2. Ambil Nilai Semester 1 & 2 untuk tahun ajaran ini
		const [nk1Res, nk2Res, abs1Res, abs2Res, mapelRes, kktpRes, savedPlenoRes] = await Promise.all([
			supabase.from('rapor_nilai_kuantitatif').select('*').in('siswa_id', siswaIds).eq('semester', 1).eq('tahun_ajaran', tahunAjaran),
			supabase.from('rapor_nilai_kuantitatif').select('*').in('siswa_id', siswaIds).eq('semester', 2).eq('tahun_ajaran', tahunAjaran),
			supabase.from('rapor_ketidakhadiran').select('*').in('siswa_id', siswaIds).eq('semester', 1).eq('tahun_ajaran', tahunAjaran),
			supabase.from('rapor_ketidakhadiran').select('*').in('siswa_id', siswaIds).eq('semester', 2).eq('tahun_ajaran', tahunAjaran),
			supabase.from('mapel').select('id, mapel, nama_resmi, kelompok').neq('kelompok', 'Ekskul').not('id', 'in', '("MP-ASW","MP-KHOT")'),
			supabase.from('kktp').select('mapel_id, nilai_kktp').maybeSingle ? supabase.from('kktp').select('*') : Promise.resolve({ data: [] }),
			supabase.from('app_settings').select('value').eq('key', `rapor_pleno_${tahunAjaran}_${kelasId}`).maybeSingle(),
		]);

		const nk1 = nk1Res.data || [];
		const nk2 = nk2Res.data || [];
		const abs1 = abs1Res.data || [];
		const abs2 = abs2Res.data || [];
		const mapelList = mapelRes.data || [];
		const defaultKKTP = 75;
		const savedPlenoMap = savedPlenoRes?.data?.value || {};

		// 3. Ambil Akumulasi Poin Pelanggaran / Prestasi Siswa
		const { data: poinRows } = await supabase
			.from('poin')
			.select('siswa_id, tipe, poin')
			.in('siswa_id', siswaIds);

		const poinPerSiswa = {};
		(poinRows || []).forEach((p) => {
			if (!poinPerSiswa[p.siswa_id]) poinPerSiswa[p.siswa_id] = 0;
			const val = parseInt(p.poin || 0, 10);
			if (!Number.isNaN(val)) {
				poinPerSiswa[p.siswa_id] += (p.tipe === 'positif' ? val : -val);
			}
		});

		// 4. Evaluasi 4 Kriteria Resmi untuk Setiap Siswa
		const evaluasiList = siswaList.map((siswa) => {
			const sNk1 = nk1.filter((n) => n.siswa_id === siswa.id);
			const sNk2 = nk2.filter((n) => n.siswa_id === siswa.id);
			const sAbs1 = abs1.find((a) => a.siswa_id === siswa.id) || {};
			const sAbs2 = abs2.find((a) => a.siswa_id === siswa.id) || {};

			// Kriteria 1: Nilai tidak tuntas <= 2
			let mapelTidakTuntas = 0;
			const rincianTidakTuntas = [];
			mapelList.forEach((m) => {
				const val1 = sNk1.find((n) => n.mapel_id === m.id)?.nilai_akhir;
				const val2 = sNk2.find((n) => n.mapel_id === m.id)?.nilai_akhir;

				let rataRata = null;
				if (val1 !== undefined && val2 !== undefined) {
					rataRata = Math.round((Number(val1) + Number(val2)) / 2);
				} else if (val2 !== undefined) {
					rataRata = Number(val2);
				} else if (val1 !== undefined) {
					rataRata = Number(val1);
				}

				if (rataRata !== null && rataRata < defaultKKTP) {
					mapelTidakTuntas++;
					rincianTidakTuntas.push(`${m.nama_resmi || m.mapel} (${rataRata} < ${defaultKKTP})`);
				}
			});

			const passKriteria1 = mapelTidakTuntas <= 2;

			// Kriteria 2: Alpa <= 10% total hari belajar efektif (~20 hari per semester x 2 = ~40 minggu = ~200 hari -> 10% = 20 hari)
			const totalAlpa = (sAbs1.tanpa_keterangan ?? sAbs1.alpa ?? 0) + (sAbs2.tanpa_keterangan ?? sAbs2.alpa ?? 0);
			const batasMaksAlpa = 20; // 10% dari ~200 hari belajar efektif tahunan
			const passKriteria2 = totalAlpa <= batasMaksAlpa;

			// Kriteria 3: Perilaku / Sikap Minimal B
			const netPoin = poinPerSiswa[siswa.id] ?? 0;
			const konversi = konversiPoinKeSikap(netPoin);
			// Default sikap adalah B jika net poin normal (tidak pelanggaran berat)
			let sikapFinal = konversi.predikat;
			if (netPoin >= -49 && (sikapFinal === 'C' || sikapFinal === 'D')) {
				sikapFinal = 'B'; // Toleransi sikap dasar sesuai standar Kurikulum Merdeka
			}
			const passKriteria3 = sikapFinal === 'A' || sikapFinal === 'B';

			// Kriteria 4: Menyelesaikan seluruh program pembelajaran semester 1 dan 2
			const passKriteria4 = sNk1.length > 0 && sNk2.length > 0;

			// Evaluasi Keseluruhan
			const allPassed = passKriteria1 && passKriteria2 && passKriteria3 && passKriteria4;
			const alasanGagal = [];
			if (!passKriteria1) alasanGagal.push(`${mapelTidakTuntas} mapel di bawah KKTP: ${rincianTidakTuntas.join(', ')}`);
			if (!passKriteria2) alasanGagal.push(`Alpa melebihi 10% (${totalAlpa} hari)`);
			if (!passKriteria3) alasanGagal.push(`Predikat sikap ${sikapFinal} (di bawah B)`);
			if (!passKriteria4) alasanGagal.push(`Nilai belum lengkap di kedua semester`);

			// Rekomendasi Keputusan Default Berdasarkan Tingkat Kelas
			const currentTingkat = klsData.tingkat || (klsData.nama_kelas.startsWith('VII') ? 7 : klsData.nama_kelas.startsWith('VIII') ? 8 : 9);
			const defaultNextClass = currentTingkat === 7 ? 'Naik ke Kelas VIII' : currentTingkat === 8 ? 'Naik ke Kelas IX' : 'Lulus dari Satuan Pendidikan';

			const savedDecision = savedPlenoMap[siswa.id] || {};

			return {
				siswa_id: siswa.id,
				nama_lengkap: siswa.nama_lengkap,
				nis: siswa.nis || '-',
				nisn: siswa.nisn || '-',
				kriteria: {
					k1_mapel_tuntas: { pass: passKriteria1, tidak_tuntas_count: mapelTidakTuntas, rincian: rincianTidakTuntas },
					k2_alpa: { pass: passKriteria2, total_alpa: totalAlpa, batas_maks: batasMaksAlpa },
					k3_sikap: { pass: passKriteria3, predikat: sikapFinal, net_poin: netPoin },
					k4_kelengkapan: { pass: passKriteria4, sem1_count: sNk1.length, sem2_count: sNk2.length },
				},
				status_rekomendasi: allPassed ? 'Memenuhi Syarat Kenaikan' : 'Perlu Pembahasan Pleno',
				alasan_sistem: alasanGagal,
				keputusan_pleno: savedDecision.keputusan || (allPassed ? defaultNextClass : `Tinggal di Kelas ${klsData.nama_kelas}`),
				catatan_pleno: savedDecision.catatan || '',
				default_next_class: defaultNextClass,
			};
		});

		return NextResponse.json({
			kelas: klsData,
			tahun_ajaran: tahunAjaran,
			total_siswa: evaluasiList.length,
			memenuhi_syarat_count: evaluasiList.filter((e) => e.status_rekomendasi === 'Memenuhi Syarat Kenaikan').length,
			perlu_pembahasan_count: evaluasiList.filter((e) => e.status_rekomendasi !== 'Memenuhi Syarat Kenaikan').length,
			evaluasi: evaluasiList,
		});
	} catch (error) {
		console.error('Error GET erapor pleno:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const isPrivileged =
			role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah' || role === 'Superadmin' || role === 'Guru';
		if (!isPrivileged) {
			return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
		}

		const body = await request.json();
		const { kelas_id, tahun_ajaran, decisions } = body;

		if (!kelas_id || !tahun_ajaran || !decisions) {
			return NextResponse.json({ error: 'kelas_id, tahun_ajaran, dan decisions wajib diisi' }, { status: 400 });
		}

		// Simpan ke app_settings untuk persistensi instan
		const key = `rapor_pleno_${tahun_ajaran}_${kelas_id}`;
		await supabase.from('app_settings').upsert({
			key,
			value: decisions,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'key' });

		// Coba simpan ke rapor_pleno_kenaikan jika tabel ada
		try {
			for (const [siswaId, d] of Object.entries(decisions)) {
				await supabase.from('rapor_pleno_kenaikan').upsert({
					siswa_id: siswaId,
					tahun_ajaran,
					keputusan_pleno: d.keputusan,
					catatan_pleno: d.catatan || '',
					diputuskan_oleh: userId,
					updated_at: new Date().toISOString(),
				}, { onConflict: 'siswa_id,tahun_ajaran' });
			}
		} catch (e) {
			// ignore
		}

		return NextResponse.json({ success: true, count: Object.keys(decisions).length });
	} catch (error) {
		console.error('Error POST erapor pleno:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
