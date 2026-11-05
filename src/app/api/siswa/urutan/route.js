import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');

		if (!kelas) {
			return NextResponse.json({ error: 'Parameter kelas wajib disertakan' }, { status: 400 });
		}

		// Coba query dengan nomor_absen
		let { data: siswaList, error } = await supabaseAdmin
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap, kelas, jenis_kelamin, status, nomor_absen')
			.eq('kelas', kelas)
			.order('nomor_absen', { ascending: true, nullsFirst: false })
			.order('nama_lengkap', { ascending: true });

		let hasNomorAbsenColumn = true;

		// Jika kolom nomor_absen belum dibuat (error 42703)
		if (error && (error.code === '42703' || error.message?.includes('nomor_absen'))) {
			hasNomorAbsenColumn = false;
			const fallback = await supabaseAdmin
				.from('siswa')
				.select('id, nis, nisn, nama_lengkap, kelas, jenis_kelamin, status')
				.eq('kelas', kelas)
				.order('nama_lengkap', { ascending: true });

			if (fallback.error) throw fallback.error;
			siswaList = fallback.data;
		} else if (error) {
			throw error;
		}

		return NextResponse.json({
			success: true,
			kelas,
			hasNomorAbsenColumn,
			data: siswaList || [],
		});
	} catch (error) {
		console.error('GET /api/siswa/urutan Error:', error);
		return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		let role = req.headers.get('x-user-role');
		let userId = req.headers.get('x-user-id');

		const supabase = await createClient();

		if (!role || !userId) {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: profile } = await supabaseAdmin
					.from('users')
					.select('id_user, role')
					.eq('auth_id', user.id)
					.maybeSingle();

				if (profile) {
					role = profile.role;
					userId = profile.id_user;
				}
			}
		}

		// Hak akses: Admin, Kurikulum, Kepala Sekolah, atau Guru (Wali Kelas)
		const isPrivileged = role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah';

		const body = await req.json();
		const { kelas, urutan } = body;

		if (!kelas || !Array.isArray(urutan) || urutan.length === 0) {
			return NextResponse.json({ error: 'Data kelas dan daftar urutan wajib diisi' }, { status: 400 });
		}

		// Validasi otorisasi Guru: harus Wali Kelas dari kelas yang bersangkutan
		if (role === 'Guru' && !isPrivileged) {
			if (!userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Identitas sesi tidak valid' }, { status: 403 });
			}

			const { data: kelasData } = await supabaseAdmin
				.from('kelas')
				.select('id_wali_kelas, nama_kelas')
				.ilike('nama_kelas', kelas.trim())
				.maybeSingle();

			if (!kelasData || kelasData.id_wali_kelas !== userId) {
				return NextResponse.json({
					error: 'Akses Ditolak: Anda bukan wali kelas dari rombel ini. Pengaturan urutan hanya dapat dilakukan oleh Wali Kelas yang bersangkutan, Kurikulum, atau Admin.'
				}, { status: 403 });
			}
		} else if (!isPrivileged) {
			return NextResponse.json({ error: 'Akses Ditolak: Peran pengguna tidak memiliki hak mengubah urutan rombel' }, { status: 403 });
		}

		// Update batch setiap nomor_absen siswa
		const updates = urutan.map((item) => {
			return supabaseAdmin
				.from('siswa')
				.update({ nomor_absen: item.nomor_absen != null ? Number(item.nomor_absen) : null })
				.eq('id', item.id);
		});

		const results = await Promise.all(updates);
		const failed = results.find((r) => r.error);
		if (failed && failed.error) {
			if (failed.error.code === '42703' || failed.error.message?.includes('nomor_absen')) {
				return NextResponse.json({
					error: 'Kolom nomor_absen belum tersedia di database. Silakan jalankan file migrasi migrations/20261104_add_nomor_absen_to_siswa.sql terlebih dahulu di Supabase SQL Editor.',
					migrationNeeded: true,
				}, { status: 400 });
			}
			throw failed.error;
		}

		return NextResponse.json({
			success: true,
			message: `Berhasil memperbarui nomor urut untuk ${urutan.length} siswa di kelas ${kelas}`,
			count: urutan.length,
		});
	} catch (error) {
		console.error('PUT /api/siswa/urutan Error:', error);
		return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}
