import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normStatus } from '@/lib/absensiUtils';
import { checkClassLock } from '@/utils/erapor';

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

		// 1. Ambil data kelas
		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas, id_wali_kelas, wali_kelas')
			.eq('id', kelasId)
			.single();
		if (kelasErr) throw kelasErr;

		// Validasi: Khusus role Guru, harus menjadi Wali Kelas rombel ini
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
					{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat mengelola presensi semester rombel ini.' },
					{ status: 403 }
				);
			}
		}

		// 2. Ambil siswa aktif
		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });
		if (siswaErr) throw siswaErr;

		// 3. Ambil rekap absensi rapor yang sudah ada
		let existingAbsen = [];
		if (tahunAjaran) {
			const { data: absenData, error: absenErr } = await supabase
				.from('rapor_ketidakhadiran')
				.select('*')
				.eq('kelas_id', kelasId)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);
			if (absenErr) throw absenErr;
			existingAbsen = absenData || [];
		}

		const mapAbsen = {};
		existingAbsen.forEach((item) => {
			const aVal = item.tanpa_keterangan ?? item.alpa ?? item.alfa ?? 0;
			const cVal = item.catatan_wali_kelas || item.catatan || '';
			mapAbsen[item.siswa_id] = {
				sakit: item.sakit ?? 0,
				izin: item.izin ?? 0,
				tanpa_keterangan: aVal,
				alfa: aVal,
				alpa: aVal,
				catatan_wali_kelas: cVal,
				catatan: cVal,
			};
		});

		const result = (siswaList || []).map((s) => ({
			siswa_id: s.id,
			nis: s.nis,
			nisn: s.nisn,
			nama_lengkap: s.nama_lengkap,
			sakit: mapAbsen[s.id]?.sakit ?? 0,
			izin: mapAbsen[s.id]?.izin ?? 0,
			tanpa_keterangan: mapAbsen[s.id]?.tanpa_keterangan ?? 0,
			alfa: mapAbsen[s.id]?.alfa ?? 0,
			alpa: mapAbsen[s.id]?.alpa ?? 0,
			catatan_wali_kelas: mapAbsen[s.id]?.catatan_wali_kelas ?? '',
			catatan: mapAbsen[s.id]?.catatan ?? '',
		}));

		return NextResponse.json({
			kelas: kelasData,
			semester,
			tahun_ajaran: tahunAjaran,
			students: result,
		});
	} catch (error) {
		console.error('Error GET rapor_ketidakhadiran:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const { kelas_id, semester, tahun_ajaran, payload, action } = body;

		if (!kelas_id || !tahun_ajaran) {
			return NextResponse.json({ error: 'kelas_id dan tahun_ajaran wajib diisi' }, { status: 400 });
		}

		// Validasi Hak Akses Wali Kelas
		if (role === 'Guru' && userId) {
			const { data: kelasData } = await supabase.from('kelas').select('id_wali_kelas, wali_kelas').eq('id', kelas_id).maybeSingle();
			const isDirectWali = kelasData?.id_wali_kelas === userId;
			let isRelasiWali = false;
			if (!isDirectWali) {
				const { data: relasi } = await supabase
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('id_kelas', kelas_id)
					.eq('is_active', true)
					.maybeSingle();
				if (relasi) isRelasiWali = true;
			}
			let isNameWali = false;
			if (!isDirectWali && !isRelasiWali && kelasData?.wali_kelas) {
				const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
				if (userRow?.nama_lengkap && kelasData.wali_kelas.includes(userRow.nama_lengkap)) {
					isNameWali = true;
				}
			}
			if (!isDirectWali && !isRelasiWali && !isNameWali) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat menyimpan data presensi ini.' },
					{ status: 403 }
				);
			}
		}

		// Aksi 1: TARIK DARI ABSENSI HARIAN OTOMATIS
		if (action === 'sync_harian') {
			const { data: kls } = await supabase.from('kelas').select('nama_kelas').eq('id', kelas_id).single();
			if (!kls) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });

			const { data: rawAbsensi, error: absError } = await supabase
				.from('absensi_harian_siswa')
				.select('siswa_id, status')
				.eq('kelas', kls.nama_kelas)
				.or('status.ilike.alfa%,status.ilike.alpa%,status.ilike.alpha%,status.eq.A,status.eq.a,status.ilike.sakit%,status.ilike.izin%');

			if (absError) throw absError;

			const countMap = {};
			(rawAbsensi || []).forEach((row) => {
				const sid = row.siswa_id;
				if (!countMap[sid]) countMap[sid] = { sakit: 0, izin: 0, alfa: 0 };
				const st = normStatus(row.status);
				if (st === 'sakit') countMap[sid].sakit += 1;
				else if (st === 'izin') countMap[sid].izin += 1;
				else if (st === 'alfa') countMap[sid].alfa += 1;
			});

			return NextResponse.json({
				success: true,
				message: 'Penarikan absensi harian berhasil dihitung',
				data: countMap,
			});
		}

		// Cek apakah rombel terkunci
		const lockInfo = await checkClassLock(supabase, {
			kelasId: kelas_id,
			tahun_ajaran,
			semester,
		});
		if (lockInfo.isLocked) {
			const isPrivileged = role === 'Admin' || role === 'Kurikulum' || role === 'Superadmin';
			if (!isPrivileged) {
				return NextResponse.json(
					{
						error: `Akses Ditolak: Rombel ini telah dikunci (${lockInfo.lockedByName}). Data presensi dan catatan rapor tidak dapat diubah lagi.`,
					},
					{ status: 403 }
				);
			}
		}

		// Aksi 2: SIMPAN REKAP PRESENSI RAPOR
		const listToSave = Array.isArray(payload) ? payload : Array.isArray(body.data_absensi) ? body.data_absensi : null;
		if (!listToSave) {
			return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
		}

		const rowsToUpsert = listToSave.map((p) => {
			const aVal = parseInt(p.tanpa_keterangan ?? p.alfa ?? p.alpa ?? 0, 10) || 0;
			const cVal = (p.catatan_wali_kelas ?? p.catatan ?? '').trim();
			return {
				siswa_id: p.siswa_id,
				kelas_id,
				semester: parseInt(semester, 10) || 1,
				tahun_ajaran,
				sakit: parseInt(p.sakit, 10) || 0,
				izin: parseInt(p.izin, 10) || 0,
				tanpa_keterangan: aVal,
				catatan_wali_kelas: cVal,
				updated_at: new Date().toISOString(),
			};
		});

		if (rowsToUpsert.length === 0) {
			return NextResponse.json({ message: 'Tidak ada data untuk disimpan' });
		}

		const { data, error } = await supabase
			.from('rapor_ketidakhadiran')
			.upsert(rowsToUpsert, {
				onConflict: 'siswa_id,semester,tahun_ajaran',
			})
			.select();

		if (error) throw error;

		return NextResponse.json({
			success: true,
			count: data?.length || rowsToUpsert.length,
			message: 'Rekap ketidakhadiran berhasil disimpan',
		});
	} catch (error) {
		console.error('Error POST rapor_ketidakhadiran:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
