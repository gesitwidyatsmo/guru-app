import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { isEkskulMapel, isEkskulApplicableForTingkat, normalizeTingkatArray } from '@/lib/eraporEkskulUtils';

const DEFAULT_EKSKUL = [
	{ id: 1, nama_ekskul: 'Praja Muda Karana (Pramuka)', kategori: 'Wajib', deskripsi_standar: 'Aktif dan tertib mengikuti kegiatan kepramukaan mingguan.', urutan: 1, is_aktif: true, tingkat: [7, 8, 9] },
	{ id: 2, nama_ekskul: 'Tahfidz Al-Qur\'an', kategori: 'Pilihan', deskripsi_standar: 'Disiplin menambah ziyadah dan memutqinkan hafalan Al-Qur\'an.', urutan: 2, is_aktif: true, tingkat: [7, 8, 9] },
	{ id: 3, nama_ekskul: 'Futsal & Olahraga', kategori: 'Pilihan', deskripsi_standar: 'Memiliki sportivitas tinggi, fisik tangguh, dan kerjasama tim yang baik.', urutan: 3, is_aktif: true, tingkat: [7, 8, 9] },
	{ id: 4, nama_ekskul: 'Hadrah & Seni Islami', kategori: 'Pilihan', deskripsi_standar: 'Terampil membawakan lantunan shalawat dan seni hadrah dengan kompak.', urutan: 4, is_aktif: true, tingkat: [7, 8, 9] },
	{ id: 5, nama_ekskul: 'Palang Merah Remaja (PMR)', kategori: 'Pilihan', deskripsi_standar: 'Cekatan, berempati tinggi, dan aktif dalam pertolongan pertama serta kepalangmerahan.', urutan: 5, is_aktif: true, tingkat: [7, 8, 9] },
	{ id: 6, nama_ekskul: 'Seni Baca Al-Qur\'an (Tilawah)', kategori: 'Pilihan', deskripsi_standar: 'Mampu melantunkan ayat suci Al-Qur\'an dengan kaidah tajwid dan nagham yang indah.', urutan: 6, is_aktif: true, tingkat: [7, 8, 9] },
];

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
		const tingkatParam = searchParams.get('tingkat');

		let rawList = null;

		// 1. Coba dari app_settings terlebih dahulu (penyimpanan utama seragam & berjenjang)
		try {
			const { data: appSet } = await supabase
				.from('app_settings')
				.select('value')
				.eq('key', 'master_ekstrakurikuler')
				.maybeSingle();

			if (appSet?.value && Array.isArray(appSet.value) && appSet.value.length > 0) {
				rawList = appSet.value;
			}
		} catch (aErr) {
			// fallback
		}

		// 2. Coba dari tabel master_ekstrakurikuler jika app_settings belum ada
		if (!rawList) {
			try {
				const { data: ekskuls, error: dbErr } = await supabase
					.from('master_ekstrakurikuler')
					.select('*')
					.order('urutan', { ascending: true });

				if (!dbErr && ekskuls && ekskuls.length > 0) {
					rawList = ekskuls;
				}
			} catch (err) {
				// fallback
			}
		}

		if (!rawList) {
			rawList = DEFAULT_EKSKUL;
		}

		// Pastikan setiap item memiliki properti tingkat yang dinormalisasi sebagai array [7, 8, 9]
		// dan menyaring mapel pesantren (Aswaja & Khot) agar murni memuat ekskul wajib Pramuka & pilihan
		const normalized = (rawList || [])
			.filter((e) => !isEkskulMapel(e.nama_ekskul))
			.map((e) => {
				return {
					...e,
					tingkat: normalizeTingkatArray(e.tingkat, e.nama_ekskul),
				};
			});

		// Jika ada filter tingkat kelas (misal: tingkat=7)
		if (tingkatParam) {
			const filtered = normalized.filter((e) =>
				isEkskulApplicableForTingkat(e.nama_ekskul, tingkatParam, e.tingkat)
			);
			return NextResponse.json(filtered);
		}

		return NextResponse.json(normalized);
	} catch (error) {
		console.error('Error GET master-ekskul:', error);
		return NextResponse.json(DEFAULT_EKSKUL);
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role } = await getAuthInfo(request, supabase);

		const isPrivileged =
			role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah' || role === 'Superadmin';
		if (!isPrivileged) {
			return NextResponse.json({ error: 'Akses Ditolak: Hanya Kurikulum atau Admin.' }, { status: 403 });
		}

		const body = await request.json();
		const rawList = Array.isArray(body) ? body : body.list || [];
		const list = rawList.map((e) => ({
			...e,
			tingkat: normalizeTingkatArray(e.tingkat, e.nama_ekskul),
		}));

		// 1. Simpan ke app_settings secara instan (1 query terpadu)
		await supabase.from('app_settings').upsert({
			key: 'master_ekstrakurikuler',
			value: list,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'key' });

		// 2. Sinkronkan ke master_ekstrakurikuler secara batch (cepat tanpa sequential loop)
		(async () => {
			try {
				const batchRows = list
					.filter((item) => Boolean(item.nama_ekskul))
					.map((item) => ({
						id: item.id && typeof item.id === 'number' && item.id < 1000000000000 ? item.id : undefined,
						nama_ekskul: item.nama_ekskul,
						kategori: item.kategori || 'Pilihan',
						deskripsi_standar: item.deskripsi_standar || '',
						urutan: item.urutan || 1,
						is_aktif: item.is_aktif ?? true,
					}));

				if (batchRows.length > 0) {
					await supabase.from('master_ekstrakurikuler').upsert(batchRows);
				}

				// Hapus baris yang sudah dihapus dari list
				const validDbIds = batchRows.map((r) => r.id).filter(Boolean);
				if (validDbIds.length > 0) {
					await supabase
						.from('master_ekstrakurikuler')
						.delete()
						.not('id', 'in', `(${validDbIds.join(',')})`);
				}
			} catch (e) {
				// ignore
			}
		})();

		return NextResponse.json({ success: true, count: list.length });
	} catch (error) {
		console.error('Error POST master-ekskul:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
