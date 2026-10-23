import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const DEFAULT_GEOFENCE = {
	enabled: false,
	lat: -6.200000,
	lng: 106.816666,
	radius: 200,
	nama_lokasi: 'Area Sekolah',
	berlaku_untuk: ['jurnal', 'absensi'],
};

async function getActiveKepsekInfo() {
	try {
		const { data: kepsekUser } = await supabaseAdmin
			.from('users')
			.select('*')
			.eq('role', 'Kepala Sekolah')
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (kepsekUser) {
			return {
				nama_kepsek: kepsekUser.nama_lengkap || '',
				nip_kepsek: kepsekUser.nip || '',
			};
		}
	} catch (err) {
		console.warn('⚠️ Gagal memuat user Kepala Sekolah:', err);
	}
	return { nama_kepsek: '', nip_kepsek: '' };
}

// GET — Ambil pengaturan aplikasi berdasarkan key atau semua
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const key = searchParams.get('key');

		// Hanya key 'profil_sekolah' yang bersifat publik (dibutuhkan untuk halaman login, identitas, dll)
		if (key !== 'profil_sekolah') {
			let role = req.headers.get('x-user-role');
			if (!role) {
				const authClient = await createClient();
				const { data: { user } } = await authClient.auth.getUser();
				if (!user) {
					return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
				}
			}
		}

		// Gunakan supabaseAdmin agar tidak terblokir RLS saat membaca profil sekolah / kop surat
		const supabase = supabaseAdmin || (await createClient());

		if (key) {
			const { data, error } = await supabase
				.from('app_settings')
				.select('*')
				.eq('key', key)
				.maybeSingle();

			if (error) {
				// Fallback jika tabel app_settings belum dibuat di Supabase
				if (error.code === '42P01' || error.message?.includes('does not exist')) {
					console.warn('⚠️ Tabel app_settings belum ada. Menggunakan nilai default untuk key:', key);
					if (key === 'geofence') {
						return NextResponse.json({ key: 'geofence', value: DEFAULT_GEOFENCE, _fallback: true });
					}
					if (key === 'profil_sekolah') {
						const kepsekInfo = await getActiveKepsekInfo();
						return NextResponse.json({ key: 'profil_sekolah', value: kepsekInfo, _fallback: true });
					}
					return NextResponse.json({ key, value: null, _fallback: true });
				}
				throw error;
			}

			if (!data && key === 'geofence') {
				return NextResponse.json({ key: 'geofence', value: DEFAULT_GEOFENCE, _seeded: false });
			}

			if (key === 'profil_sekolah') {
				let profileVal = data?.value || {};
				const kepsekInfo = await getActiveKepsekInfo();
				if (kepsekInfo.nama_kepsek) {
					profileVal = {
						...profileVal,
						nama_kepsek: kepsekInfo.nama_kepsek,
						nip_kepsek: kepsekInfo.nip_kepsek,
					};
				}
				return NextResponse.json({ ...(data || { key: 'profil_sekolah' }), value: profileVal });
			}

			return NextResponse.json(data || { key, value: null });
		}

		// Jika tanpa parameter key, ambil semua pengaturan
		const { data, error } = await supabase.from('app_settings').select('*');
		if (error) {
			if (error.code === '42P01' || error.message?.includes('does not exist')) {
				return NextResponse.json([{ key: 'geofence', value: DEFAULT_GEOFENCE, _fallback: true }]);
			}
			throw error;
		}

		if (Array.isArray(data)) {
			const kepsekInfo = await getActiveKepsekInfo();
			const enriched = data.map((item) => {
				if (item.key === 'profil_sekolah' && typeof item.value === 'object' && item.value) {
					return {
						...item,
						value: {
							...item.value,
							nama_kepsek: kepsekInfo.nama_kepsek || item.value.nama_kepsek || '',
							nip_kepsek: kepsekInfo.nip_kepsek || item.value.nip_kepsek || '',
						},
					};
				}
				return item;
			});
			return NextResponse.json(enriched);
		}
	} catch (error) {
		console.error('❌ GET settings error:', error);
		return NextResponse.json({ error: 'Gagal memuat pengaturan aplikasi' }, { status: 500 });
	}
}

// PUT — Perbarui pengaturan aplikasi (Khusus Admin)
export async function PUT(req) {
	try {
		// Gunakan supabaseAdmin agar tidak terblokir RLS saat membaca profil sekolah / kop surat
		const supabase = supabaseAdmin || (await createClient());
		let role = req.headers.get('x-user-role');

		if (!role) {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: userProfile } = await supabase
					.from('users')
					.select('role')
					.eq('auth_id', user.id)
					.maybeSingle();
				role = userProfile?.role;
			}
		}

		const body = await req.json();
		const { key, value } = body;

		if (!key || value === undefined) {
			return NextResponse.json({ error: 'Parameter "key" dan "value" wajib diisi.' }, { status: 400 });
		}

		// Izin khusus pengaturan bisaroh dan pengajuan:
		// - Bendahara boleh mengubah 'bisaroh_settings' dan 'bisaroh_submissions'
		// - Kepala Sekolah boleh mengubah 'bisaroh_submissions' (approval / revisi)
		// - Admin boleh mengubah semua
		const isBendaharaAllowed = role === 'Bendahara' && (key === 'bisaroh_settings' || key === 'bisaroh_submissions');
		const isKepsekAllowed = role === 'Kepala Sekolah' && key === 'bisaroh_submissions';

		if (role !== 'Admin' && !isBendaharaAllowed && !isKepsekAllowed) {
			return NextResponse.json({ error: 'Akses ditolak: Anda tidak memiliki izin mengubah pengaturan ini.' }, { status: 403 });
		}

		// Gunakan supabaseAdmin untuk memastikan bypass RLS jika diperlukan saat upsert setting
		const client = supabaseAdmin || (await createClient());

		const { data, error } = await client
			.from('app_settings')
			.upsert(
				{
					key,
					value,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'key' }
			)
			.select()
			.single();

		if (error) {
			if (error.code === '42P01' || error.message?.includes('does not exist')) {
				return NextResponse.json(
					{
						error: 'Tabel "app_settings" belum dibuat di Supabase. Silakan jalankan file migrasi migrations/add_app_settings_geofence.sql terlebih dahulu di SQL Editor Supabase.',
						missingTable: true,
					},
					{ status: 500 }
				);
			}
			throw error;
		}

		return NextResponse.json({ success: true, setting: data }, { status: 200 });
	} catch (error) {
		console.error('❌ PUT settings error:', error);
		return NextResponse.json({ error: 'Gagal menyimpan pengaturan aplikasi: ' + (error.message || error) }, { status: 500 });
	}
}
