import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const DEFAULT_TEMPLATES = [
	{
		id: 1,
		kategori: 'Prestasi',
		judul: 'Prestasi Akademik Unggul',
		isi_catatan: 'Ananda menunjukkan capaian akademik yang sangat membanggakan dan aktif dalam pembelajaran. Pertahankan ketekunan, ibadah, dan tetaplah rendah hati.',
		urutan: 1,
	},
	{
		id: 2,
		kategori: 'Prestasi',
		judul: 'Konsistensi Belajar & Berprestasi',
		isi_catatan: 'Capaian pembelajaran ananda sangat memuaskan di seluruh mata pelajaran. Terus pertahankan semangat belajar, akhlak mulia, dan raih cita-cita yang tinggi.',
		urutan: 2,
	},
	{
		id: 3,
		kategori: 'Motivasi',
		judul: 'Dorongan Keaktifan Belajar',
		isi_catatan: 'Potensi ananda sangat baik. Tingkatkan fokus belajar dan keaktifan berdiskusi di kelas agar capaian di semester berikutnya semakin optimal.',
		urutan: 3,
	},
	{
		id: 4,
		kategori: 'Motivasi',
		judul: 'Peningkatan Fokus & Ketekunan',
		isi_catatan: 'Ananda memiliki daya tangkap yang baik jika lebih fokus dan tekun. Perbanyak mengulang materi pelajaran di asrama/rumah dan jangan ragu bertanya kepada guru.',
		urutan: 4,
	},
	{
		id: 5,
		kategori: 'Kedisiplinan',
		judul: 'Pembinaan Kehadiran & Tata Tertib',
		isi_catatan: 'Tingkatkan kedisiplinan dan ketepatan waktu hadir di sekolah. Kurangi ketidakhadiran yang tidak mendesak demi menjaga kontinuitas proses belajar.',
		urutan: 5,
	},
	{
		id: 6,
		kategori: 'Spiritual',
		judul: 'Penguatan Akhlak & Ibadah Santri',
		isi_catatan: 'Ananda santun, beradab mulia, dan taat beribadah. Terus istiqomah menjaga salat berjamaah, hafalan Al-Qur\'an, dan perilaku terpuji di pondok maupun sekolah.',
		urutan: 6,
	},
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

export async function GET() {
	try {
		const supabase = supabaseAdmin || (await createClient());

		// 1. Coba dari tabel master_template_catatan
		try {
			const { data: templates, error: dbErr } = await supabase
				.from('master_template_catatan')
				.select('*')
				.order('urutan', { ascending: true });

			if (!dbErr && templates && templates.length > 0) {
				return NextResponse.json(templates);
			}
		} catch (err) {
			// fallback
		}

		// 2. Coba dari app_settings
		try {
			const { data: appSet } = await supabase
				.from('app_settings')
				.select('value')
				.eq('key', 'master_template_catatan')
				.maybeSingle();

			if (appSet?.value && Array.isArray(appSet.value) && appSet.value.length > 0) {
				return NextResponse.json(appSet.value);
			}
		} catch (aErr) {
			// fallback
		}

		return NextResponse.json(DEFAULT_TEMPLATES);
	} catch (error) {
		console.error('Error GET template-catatan:', error);
		return NextResponse.json(DEFAULT_TEMPLATES);
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
		const list = Array.isArray(body) ? body : body.list || [];

		// Simpan ke app_settings
		await supabase.from('app_settings').upsert({
			key: 'master_template_catatan',
			value: list,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'key' });

		// Coba simpan ke master_template_catatan jika tabel ada
		try {
			for (const item of list) {
				if (item.isi_catatan) {
					await supabase.from('master_template_catatan').upsert({
						id: item.id && typeof item.id === 'number' ? item.id : undefined,
						kategori: item.kategori || 'Motivasi',
						judul: item.judul || 'Catatan Pembinaan',
						isi_catatan: item.isi_catatan,
						urutan: item.urutan || 1,
						is_aktif: item.is_aktif ?? true,
					});
				}
			}
		} catch (e) {
			// ignore
		}

		return NextResponse.json({ success: true, count: list.length });
	} catch (error) {
		console.error('Error POST template-catatan:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
