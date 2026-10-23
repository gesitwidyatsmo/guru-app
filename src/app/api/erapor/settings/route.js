import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

async function getAuthInfo(request, supabase) {
	const cookieStore = await cookies();
	let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
	let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;

	if (!role || !userId) {
		const {
			data: { user },
		} = await supabase.auth.getUser();
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

		// 1. Ambil dari tabel rapor_pengaturan
		const { data: setRapor } = await supabase
			.from('rapor_pengaturan')
			.select('*')
			.limit(1)
			.maybeSingle();

		// 2. Ambil dari app_settings sebagai fallback / pelengkap
		const [resProfil, resSetting] = await Promise.all([
			supabase.from('app_settings').select('value').eq('key', 'profil_sekolah').maybeSingle(),
			supabase.from('app_settings').select('value').eq('key', 'rapor_settings').maybeSingle(),
		]);

		const profil = resProfil?.data?.value || {};
		const extra = resSetting?.data?.value || {};

		const result = {
			tempat_rapor: setRapor?.tempat_rapor || extra.tempat_rapor || 'Kuala Gading',
			tanggal_rapor_ganjil:
				setRapor?.tanggal_rapor_ganjil ||
				setRapor?.tanggal_rapor ||
				extra.tanggal_rapor_ganjil ||
				'20 Desember 2026',
			tanggal_rapor_genap:
				setRapor?.tanggal_rapor_genap || extra.tanggal_rapor_genap || '26 Juni 2027',
			alamat_sekolah:
				setRapor?.alamat_sekolah ||
				profil.alamat ||
				'Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355',
			nama_sekolah: profil.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH',
			nama_kepsek: setRapor?.nama_kepsek || profil.nama_kepsek || 'Mujib Kodar, S.Pd,I',
			nip_kepsek: setRapor?.nip_kepsek || profil.nip_kepsek || '-',
			is_locked_global: Boolean(setRapor?.is_locked_global || extra.is_locked_global),
			locked_at_global: setRapor?.locked_at_global || extra.locked_at_global || null,
			locked_by_global: setRapor?.locked_by_global || extra.locked_by_global || null,
		};

		return NextResponse.json(result);
	} catch (error) {
		console.error('Error GET erapor settings:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const isPrivileged =
			role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah' || role === 'Superadmin';
		if (!isPrivileged) {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Kurikulum, Kepala Sekolah, atau Admin yang dapat mengatur rapor.' },
				{ status: 403 }
			);
		}

		const body = await request.json();
		const {
			tempat_rapor,
			tanggal_rapor_ganjil,
			tanggal_rapor_genap,
			alamat_sekolah,
			nama_kepsek,
			nip_kepsek,
			is_locked_global,
		} = body;

		const payload = {
			tempat_rapor: tempat_rapor?.trim() || 'Kuala Gading',
			tanggal_rapor_ganjil: tanggal_rapor_ganjil?.trim() || '20 Desember 2026',
			tanggal_rapor_genap: tanggal_rapor_genap?.trim() || '26 Juni 2027',
			alamat_sekolah: alamat_sekolah?.trim() || '',
			nama_kepsek: nama_kepsek?.trim() || 'Mujib Kodar, S.Pd,I',
			nip_kepsek: nip_kepsek?.trim() || '-',
			is_locked_global: Boolean(is_locked_global),
			updated_at: new Date().toISOString(),
		};

		if (is_locked_global) {
			payload.locked_at_global = new Date().toISOString();
			payload.locked_by_global = userId;
		} else {
			payload.locked_at_global = null;
			payload.locked_by_global = null;
		}

		// 1. Simpan ke rapor_pengaturan
		try {
			const { data: existing } = await supabase.from('rapor_pengaturan').select('id').limit(1).maybeSingle();
			if (existing) {
				await supabase.from('rapor_pengaturan').update({
					tempat_rapor: payload.tempat_rapor,
					tanggal_rapor: payload.tanggal_rapor_ganjil, // Kompatibilitas kolom lama
					tanggal_rapor_ganjil: payload.tanggal_rapor_ganjil,
					tanggal_rapor_genap: payload.tanggal_rapor_genap,
					alamat_sekolah: payload.alamat_sekolah,
					nama_kepsek: payload.nama_kepsek,
					nip_kepsek: payload.nip_kepsek,
					is_locked_global: payload.is_locked_global,
					locked_at_global: payload.locked_at_global,
					locked_by_global: payload.locked_by_global,
					updated_at: payload.updated_at,
				}).eq('id', existing.id);
			} else {
				await supabase.from('rapor_pengaturan').insert([{
					tempat_rapor: payload.tempat_rapor,
					tanggal_rapor: payload.tanggal_rapor_ganjil,
					tanggal_rapor_ganjil: payload.tanggal_rapor_ganjil,
					tanggal_rapor_genap: payload.tanggal_rapor_genap,
					alamat_sekolah: payload.alamat_sekolah,
					nama_kepsek: payload.nama_kepsek,
					nip_kepsek: payload.nip_kepsek,
					is_locked_global: payload.is_locked_global,
					locked_at_global: payload.locked_at_global,
					locked_by_global: payload.locked_by_global,
				}]);
			}
		} catch (err) {
			console.warn('Note: Update table rapor_pengaturan:', err.message);
		}

		// 2. Sinkronkan ke app_settings agar selalu tersedia
		await supabase.from('app_settings').upsert({
			key: 'rapor_settings',
			value: payload,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'key' });

		// Sinkronkan juga alamat dan kepsek ke profil_sekolah jika ada
		try {
			const { data: profRow } = await supabase.from('app_settings').select('value').eq('key', 'profil_sekolah').maybeSingle();
			if (profRow?.value) {
				const updatedProf = {
					...profRow.value,
					alamat: payload.alamat_sekolah || profRow.value.alamat,
					nama_kepsek: payload.nama_kepsek || profRow.value.nama_kepsek,
					nip_kepsek: payload.nip_kepsek || profRow.value.nip_kepsek,
				};
				await supabase.from('app_settings').update({
					value: updatedProf,
					updated_at: new Date().toISOString(),
				}).eq('key', 'profil_sekolah');
			}
		} catch (profErr) {
			console.warn('Sync profil_sekolah warning:', profErr.message);
		}

		return NextResponse.json({ success: true, data: payload });
	} catch (error) {
		console.error('Error POST erapor settings:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
