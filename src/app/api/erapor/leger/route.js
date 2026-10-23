import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

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

	if (!userId) {
		const rawName = request.headers.get('x-user-name') || cookieStore.get('user_name')?.value;
		if (rawName) {
			const userName = decodeURIComponent(rawName);
			const { data: u } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('nama_lengkap', userName)
				.maybeSingle();
			if (u) {
				userId = u.id_user;
				role = role || u.role;
			}
		}
	}

	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const { searchParams } = new URL(request.url);
		const kelasId = searchParams.get('kelas_id');
		const semester = parseInt(searchParams.get('semester') || '1', 10);
		const tahunAjaran = searchParams.get('tahun_ajaran');

		if (!kelasId) {
			return NextResponse.json({ error: 'kelas_id wajib disertakan' }, { status: 400 });
		}

		// 1. Ambil detail kelas & wali kelas
		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('*, wali:id_wali_kelas(id_user, nama_lengkap, nip)')
			.eq('id', kelasId)
			.single();
		if (kelasErr) throw kelasErr;

		// Validasi Wali Kelas untuk role Guru
		if (role === 'Guru' && userId) {
			const isDirectWali = kelasData.id_wali_kelas === userId;
			let isRelasiWali = false;
			if (!isDirectWali) {
				const { data: relasi } = await supabase
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('id_kelas', kelasId)
					.eq('is_active', true)
					.maybeSingle();
				if (relasi) isRelasiWali = true;
			}
			let isNameWali = false;
			if (!isDirectWali && !isRelasiWali && kelasData.wali_kelas) {
				const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
				if (userRow?.nama_lengkap && kelasData.wali_kelas.includes(userRow.nama_lengkap)) {
					isNameWali = true;
				}
			}
			if (!isDirectWali && !isRelasiWali && !isNameWali) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat mengakses rekap leger kelas ini.' },
					{ status: 403 }
				);
			}
		}

		// 2. Ambil seluruh siswa aktif
		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap, jenis_kelamin')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });
		if (siswaErr) throw siswaErr;

		// 3. Ambil daftar mata pelajaran intrakurikuler terurut (Kelompok A & B, mengecualikan Ekskul)
		const { data: allMapels, error: mapelErr } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi, kelompok, urutan')
			.neq('kelompok', 'Ekskul')
			.not('id', 'in', '("MP-ASW","MP-KHOT")')
			.order('kelompok', { ascending: true })
			.order('urutan', { ascending: true })
			.order('mapel', { ascending: true });
		if (mapelErr) throw mapelErr;

		// 4. Ambil seluruh nilai kuantitatif kelas ini
		let grades = [];
		if (tahunAjaran) {
			const { data: gData, error: gErr } = await supabase
				.from('rapor_nilai_kuantitatif')
				.select('siswa_id, mapel_id, nilai_akhir')
				.eq('kelas_id', kelasId)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);
			if (gErr) throw gErr;
			grades = gData || [];
		}

		// Ambil daftar mapel yang aktif diajarkan pada kelas ini dari jadwal / guru_kbm
		const [jadwalKlsRes, kbmKlsRes] = await Promise.all([
			supabase.from('jadwal').select('mapel').eq('kelas', kelasData.nama_kelas),
			supabase.from('guru_kbm').select('mapel').eq('kelas', kelasData.nama_kelas),
		]);

		const classMapelNames = new Set([
			...(jadwalKlsRes.data || []).map((j) => j.mapel).filter(Boolean),
			...(kbmKlsRes.data || []).map((k) => k.mapel).filter(Boolean),
		]);

		const gradedMapelIds = new Set(grades.map((g) => g.mapel_id).filter(Boolean));

		// Saring mapel: hanya intrakurikuler yang diajarkan di kelas ini ATAU yang sudah memiliki entri nilai
		const mapelList = (allMapels || []).filter((m) => {
			if (m.id === 'MP-ASW' || m.id === 'MP-KHOT' || m.kelompok === 'Ekskul') return false;
			if (classMapelNames.size === 0) return true; // Fallback jika kelas baru belum ada jadwal/KBM
			return (
				classMapelNames.has(m.mapel) ||
				classMapelNames.has(m.nama_resmi) ||
				gradedMapelIds.has(m.id)
			);
		});

		// Map nilai: { [siswa_id]: { [mapel_id]: nilai_akhir } }
		const gradeMap = {};
		grades.forEach((g) => {
			if (!gradeMap[g.siswa_id]) gradeMap[g.siswa_id] = {};
			gradeMap[g.siswa_id][g.mapel_id] = parseFloat(g.nilai_akhir) || 0;
		});

		// 5. Susun Baris Leger & Hitung Total + Rata-rata per siswa
		const rows = (siswaList || []).map((s) => {
			const sGrades = gradeMap[s.id] || {};
			let total = 0;
			let count = 0;

			mapelList.forEach((m) => {
				const val = sGrades[m.id];
				if (val !== undefined && val !== null && !isNaN(val)) {
					total += val;
					count += 1;
				}
			});

			const rataRata = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;

			return {
				siswa_id: s.id,
				nis: s.nis,
				nisn: s.nisn,
				nama_lengkap: s.nama_lengkap,
				jenis_kelamin: s.jenis_kelamin,
				nilai: sGrades,
				total: total,
				total_nilai: total,
				rata_rata: rataRata,
				jumlah_mapel_terisi: count,
			};
		});

		// 6. Urutkan berdasarkan total nilai tertinggi untuk perankingan
		const sorted = [...rows].sort((a, b) => b.total_nilai - a.total_nilai);
		const rankingMap = {};
		sorted.forEach((item, idx) => {
			rankingMap[item.siswa_id] = idx + 1;
		});

		// Berikan rank ke rows asli yang terurut alfabet
		const finalRows = rows.map((r) => ({
			...r,
			ranking: rankingMap[r.siswa_id] || '-',
			peringkat: rankingMap[r.siswa_id] || '-',
		}));

		return NextResponse.json({
			kelas: kelasData,
			semester,
			tahun_ajaran: tahunAjaran,
			mapel: mapelList,
			mapel_list: mapelList,
			rows: finalRows,
			students: finalRows,
		});
	} catch (error) {
		console.error('Error GET rapor_leger:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
