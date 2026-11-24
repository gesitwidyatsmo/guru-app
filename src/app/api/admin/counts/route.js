import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(request) {
	try {
		// Verifikasi role dari header (diset oleh proxy.js) atau cookie
		const role = request.headers.get('x-user-role') || request.cookies.get('user_role')?.value;
		const cleanRole = role ? decodeURIComponent(role).trim() : '';

		if (cleanRole !== 'Admin' && cleanRole !== 'Kepala Sekolah' && cleanRole !== 'Kurikulum') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Gunakan query HEAD ({ count: 'exact', head: true }) agar Supabase HANYA mengembalikan angka count,
		// dengan 0 byte payload baris data tabel (super hemat Egress!).
		const [
			{ count: penggunaCount },
			{ count: kelasCount },
			{ count: siswaCount },
			{ count: mapelCount },
		] = await Promise.all([
			supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
			supabaseAdmin.from('kelas').select('*', { count: 'exact', head: true }),
			supabaseAdmin.from('siswa').select('*', { count: 'exact', head: true }).eq('status', 'Aktif'),
			supabaseAdmin.from('mapel').select('*', { count: 'exact', head: true }),
		]);

		// Hitung antrean jurnal bentrok secara ringan dengan count head
		const { count: jurnalBentrokCount } = await supabaseAdmin
			.from('jurnal')
			.select('*', { count: 'exact', head: true })
			.or('status_verifikasi.eq.draft_bentrok,status_kehadiran.ilike.%Draft Bentrok%');

		return NextResponse.json(
			{
				pengguna: penggunaCount ?? 0,
				kelas: kelasCount ?? 0,
				siswa: siswaCount ?? 0,
				mapel: mapelCount ?? 0,
				absensi_bentrok: null,
				jurnal_bentrok: jurnalBentrokCount > 0 ? jurnalBentrokCount : null,
			},
			{
				headers: {
					'Cache-Control': 'private, max-age=60',
				},
			}
		);
	} catch (error) {
		console.error('Error fetching admin counts:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
