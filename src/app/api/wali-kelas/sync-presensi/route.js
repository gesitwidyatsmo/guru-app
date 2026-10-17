import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const generateId = () => Math.random().toString(36).slice(2, 11);

export async function POST(req) {
	try {
		const supabase = await createClient();

		// Cek autentikasi user
		const {
			data: { user: authUser },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !authUser) {
			return NextResponse.json({ error: 'Belum terautentikasi' }, { status: 401 });
		}

		const roleHeader = req.headers.get('x-user-role');
		const userIdHeader = req.headers.get('x-user-id');

		let userId = userIdHeader;
		let userRole = roleHeader;

		if (!userId || !userRole) {
			const { data: profile } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('auth_id', authUser.id)
				.single();

			if (profile) {
				userId = profile.id_user;
				userRole = profile.role;
			}
		}

		const body = await req.json();
		const { id_kelas, tanggal, data_absensi, tahun_ajar, semester } = body;

		if (!id_kelas || !tanggal || !Array.isArray(data_absensi) || data_absensi.length === 0) {
			return NextResponse.json(
				{ error: 'Parameter id_kelas, tanggal, dan data_absensi wajib diisi.' },
				{ status: 400 }
			);
		}

		// Cari detail kelas
		const { data: kelasData, error: klsError } = await supabaseAdmin
			.from('kelas')
			.select('id, nama_kelas, id_wali_kelas')
			.eq('id', id_kelas)
			.single();

		if (klsError || !kelasData) {
			return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
		}

		// Validasi otorisasi: User harus Admin atau Wali Kelas dari kelas ini
		const isAuthorized =
			userRole === 'Admin' ||
			kelasData.id_wali_kelas === userId;

		if (!isAuthorized) {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Wali Kelas bersangkutan atau Admin yang berhak mengesahkan presensi harian rombel ini.' },
				{ status: 403 }
			);
		}

		const namaKelas = kelasData.nama_kelas;

		// Cek apakah sudah ada sesi absensi_harian untuk kelas dan tanggal ini
		const { data: existingSesi } = await supabaseAdmin
			.from('absensi_harian')
			.select('sesi_id')
			.eq('kelas', namaKelas)
			.eq('tanggal', tanggal)
			.maybeSingle();

		let sesiId = existingSesi ? existingSesi.sesi_id : `SESI-H-${generateId()}`;

		if (existingSesi) {
			// Update sesi & bersihkan detail lama
			await supabaseAdmin
				.from('absensi_harian')
				.update({
					tahun_ajar: tahun_ajar || '2026/2027',
					semester: semester ? parseInt(semester, 10) : 1,
				})
				.eq('sesi_id', sesiId);

			await supabaseAdmin.from('absensi_harian_siswa').delete().eq('sesi_id', sesiId);
		} else {
			// Buat sesi absensi harian baru
			await supabaseAdmin.from('absensi_harian').insert({
				sesi_id: sesiId,
				kelas: namaKelas,
				tanggal: tanggal,
				tahun_ajar: tahun_ajar || '2026/2027',
				semester: semester ? parseInt(semester, 10) : 1,
			});
		}

		// Masukkan seluruh baris absensi siswa
		const rowsToInsert = data_absensi.map((item) => ({
			sesi_id: sesiId,
			siswa_id: item.siswa_id,
			status: item.status || 'Hadir',
			keterangan: item.keterangan || '',
		}));

		const { error: insertError } = await supabaseAdmin
			.from('absensi_harian_siswa')
			.insert(rowsToInsert);

		if (insertError) {
			throw insertError;
		}

		return NextResponse.json({
			success: true,
			sesi_id: sesiId,
			mode: existingSesi ? 'updated' : 'created',
			message: `Presensi harian resmi kelas ${namaKelas} tanggal ${tanggal} berhasil disahkan & disinkronkan (${rowsToInsert.length} siswa).`,
		});
	} catch (error) {
		console.error('Error POST /api/wali-kelas/sync-presensi:', error);
		return NextResponse.json(
			{ error: 'Gagal mengesahkan presensi: ' + error.message },
			{ status: 500 }
		);
	}
}
