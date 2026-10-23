import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

async function getAuthInfo(request, supabase) {
	const cookieStore = await cookies();
	let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
	let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;
	let userName = '';

	const rawName = request.headers.get('x-user-name') || cookieStore.get('user_name')?.value;
	if (rawName) userName = decodeURIComponent(rawName);

	if (!role || !userId || !userName) {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) {
			const { data: userProfile } = await supabaseAdmin
				.from('users')
				.select('id_user, role, nama_lengkap')
				.eq('auth_id', user.id)
				.maybeSingle();
			if (userProfile) {
				role = role || userProfile.role;
				userId = userId || userProfile.id_user;
				userName = userName || userProfile.nama_lengkap;
			}
		}
	}

	return { role, userId, userName };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { searchParams } = new URL(request.url);

		const tahunAjaran = searchParams.get('tahun_ajaran') || '2026/2027';
		const semester = parseInt(searchParams.get('semester') || '1', 10);
		const kelasId = searchParams.get('kelas_id');

		// 1. Ambil status global lock dari app_settings / rapor_pengaturan
		let isLockedGlobal = false;
		let lockedAtGlobal = null;
		try {
			const { data: setRapor } = await supabase.from('rapor_pengaturan').select('*').limit(1).maybeSingle();
			if (setRapor?.is_locked_global) {
				isLockedGlobal = true;
				lockedAtGlobal = setRapor.locked_at_global;
			}
		} catch (e) {
			// fallback
		}

		if (!isLockedGlobal) {
			const { data: appSet } = await supabase.from('app_settings').select('value').eq('key', 'rapor_settings').maybeSingle();
			if (appSet?.value?.is_locked_global) {
				isLockedGlobal = true;
				lockedAtGlobal = appSet.value.locked_at_global;
			}
		}

		// 2. Ambil status kunci rombel
		let lockStatusMap = {};

		// Coba dari tabel rapor_status_kelas
		try {
			let query = supabase
				.from('rapor_status_kelas')
				.select('*, wali:locked_by_wali(id_user, nama_lengkap)')
				.eq('tahun_ajaran', tahunAjaran)
				.eq('semester', semester);

			if (kelasId) query = query.eq('id_kelas', kelasId);

			const { data: dbLocks, error: lockErr } = await query;
			if (!lockErr && dbLocks) {
				dbLocks.forEach((item) => {
					lockStatusMap[item.id_kelas] = {
						is_locked_wali: Boolean(item.is_locked_wali),
						locked_at_wali: item.locked_at_wali,
						locked_by_name: item.wali?.nama_lengkap || 'Wali Kelas',
						catatan_kunci: item.catatan_kunci || '',
					};
				});
			}
		} catch (err) {
			// fallback ke app_settings
		}

		// Fallback sinkronisasi dari app_settings
		try {
			const { data: backupSet } = await supabase
				.from('app_settings')
				.select('value')
				.eq('key', `rapor_locks_${tahunAjaran}_${semester}`)
				.maybeSingle();

			if (backupSet?.value) {
				lockStatusMap = { ...backupSet.value, ...lockStatusMap };
			}
		} catch (bErr) {
			// ignore
		}

		return NextResponse.json({
			is_locked_global: isLockedGlobal,
			locked_at_global: lockedAtGlobal,
			locks: lockStatusMap,
		});
	} catch (error) {
		console.error('Error GET lock-kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId, userName } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const { kelas_id, tahun_ajaran, semester, lock, catatan } = body;

		if (!kelas_id || !tahun_ajaran || !semester) {
			return NextResponse.json({ error: 'kelas_id, tahun_ajaran, dan semester wajib diisi' }, { status: 400 });
		}

		// Cek hak akses: Kurikulum, Admin, Kepsek, atau Wali Kelas dari kelas bersangkutan
		const isPrivileged =
			role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah' || role === 'Superadmin';

		if (!isPrivileged) {
			// Validasi apakah user adalah Wali Kelas kelas ini
			const { data: kls } = await supabase
				.from('kelas')
				.select('id, id_wali_kelas, wali_kelas')
				.eq('id', kelas_id)
				.maybeSingle();

			let isWali = kls?.id_wali_kelas === userId;
			if (!isWali) {
				const { data: relasi } = await supabase
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('id_kelas', kelas_id)
					.eq('is_active', true)
					.maybeSingle();
				if (relasi) isWali = true;
			}
			if (!isWali && kls?.wali_kelas && userName && kls.wali_kelas.includes(userName)) {
				isWali = true;
			}

			if (!isWali) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Anda bukan Wali Kelas dari rombel ini atau Administrator.' },
					{ status: 403 }
				);
			}
		}

		const isLock = Boolean(lock);
		const lockTimestamp = isLock ? new Date().toISOString() : null;
		const lockUser = isLock ? userId : null;

		// 1. Simpan ke database tabel rapor_status_kelas
		try {
			await supabase.from('rapor_status_kelas').upsert(
				{
					id_kelas: kelas_id,
					tahun_ajaran,
					semester: parseInt(semester, 10),
					is_locked_wali: isLock,
					locked_at_wali: lockTimestamp,
					locked_by_wali: lockUser,
					catatan_kunci: catatan || (isLock ? 'Terkunci oleh Wali Kelas' : ''),
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'id_kelas,tahun_ajaran,semester' }
			);
		} catch (dbErr) {
			console.warn('Note: rapor_status_kelas table upsert warning:', dbErr.message);
		}

		// 2. Simpan juga backup di app_settings agar selalu konsisten
		const key = `rapor_locks_${tahun_ajaran}_${semester}`;
		try {
			const { data: existingApp } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
			const currentMap = existingApp?.value || {};
			currentMap[kelas_id] = {
				is_locked_wali: isLock,
				locked_at_wali: lockTimestamp,
				locked_by_name: userName || 'Wali Kelas',
				catatan_kunci: catatan || '',
			};

			await supabase.from('app_settings').upsert({
				key,
				value: currentMap,
				updated_at: new Date().toISOString(),
			}, { onConflict: 'key' });
		} catch (appErr) {
			console.warn('Backup lock app_settings warning:', appErr.message);
		}

		return NextResponse.json({
			success: true,
			kelas_id,
			is_locked_wali: isLock,
			locked_at_wali: lockTimestamp,
			locked_by_name: userName || 'Wali Kelas',
		});
	} catch (error) {
		console.error('Error POST lock-kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
