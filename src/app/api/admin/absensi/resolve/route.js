import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normalizeJamKe, checkJamOverlap, normStatus } from '@/lib/absensiUtils';
import { calculateDurationMinutes, getExpectedScheduleTimes } from '@/lib/kbmRealtimeUtils';

async function checkAdminAuth(req, supabase) {
	let role = req.headers.get('x-user-role');
	let userId = req.headers.get('x-user-id');

	// Fallback 1: Cek cookie user_role & user_id dari request
	if (!role || !userId) {
		role = req.cookies.get('user_role')?.value;
		userId = req.cookies.get('user_id')?.value;
	}

	if (role) role = decodeURIComponent(role).trim();

	// Fallback 2: Cek sesi Supabase Auth & ambil data profile via supabaseAdmin
	if (!role || !userId) {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('auth_id', user.id)
				.single();
			if (profile) {
				role = profile.role;
				userId = profile.id_user;
			}
		}
	}

	const isAuthorized = role === 'Admin' || role === 'Kurikulum' || role === 'Kepala Sekolah';
	return { isAuthorized, role, userId };
}

// ---------------------------------------------------------------------------
// POST: Resolusi Konflik Bentrok Jam & 1-Klik Buat Jurnal untuk Presensi
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized, role, userId } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const { action, sync_jurnal = true } = body;

		const nowWib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
		let adminName = role || 'Admin';
		if (userId) {
			const { data: u } = await supabaseAdmin
				.from('users')
				.select('nama_lengkap')
				.eq('id_user', userId)
				.maybeSingle();
			if (u?.nama_lengkap) adminName = u.nama_lengkap;
		}

		// -----------------------------------------------------------------------
		// 1. AKSI: RESOLUSI SESUAIKAN JAM BENTROK (adjust_jam)
		// -----------------------------------------------------------------------
		if (action === 'adjust_jam') {
			const { sesi_id_a, sesi_id_b, jam_ke_a, jam_ke_b } = body;

			if (!sesi_id_a && !sesi_id_b) {
				return NextResponse.json({ error: 'Minimal satu ID sesi presensi wajib disertakan.' }, { status: 400 });
			}

			const results = [];

			if (sesi_id_a && jam_ke_a) {
				const normJamA = normalizeJamKe(jam_ke_a);
				const { data: updatedA, error: errA } = await supabaseAdmin
					.from('absensi_mapel')
					.update({
						jam_ke: normJamA,
						updated_at: new Date().toISOString(),
						catatan_admin: `Jam disesuaikan oleh ${adminName} pada ${nowWib} (Resolusi Bentrok).`,
					})
					.eq('sesi_id', sesi_id_a)
					.select();

				if (errA) throw errA;
				results.push(updatedA);

				if (sync_jurnal) {
					await supabaseAdmin
						.from('jurnal')
						.update({ jam_ke: normJamA })
						.eq('sesi_absensi_id', sesi_id_a);
				}
			}

			if (sesi_id_b && jam_ke_b) {
				const normJamB = normalizeJamKe(jam_ke_b);
				const { data: updatedB, error: errB } = await supabaseAdmin
					.from('absensi_mapel')
					.update({
						jam_ke: normJamB,
						updated_at: new Date().toISOString(),
						catatan_admin: `Jam disesuaikan oleh ${adminName} pada ${nowWib} (Resolusi Bentrok).`,
					})
					.eq('sesi_id', sesi_id_b)
					.select();

				if (errB) throw errB;
				results.push(updatedB);

				if (sync_jurnal) {
					await supabaseAdmin
						.from('jurnal')
						.update({ jam_ke: normJamB })
						.eq('sesi_absensi_id', sesi_id_b);
				}
			}

			return NextResponse.json({
				success: true,
				message: 'Jam presensi berhasil disesuaikan dan konflik bentrok terselesaikan.',
				data: results,
			});
		}

		// -----------------------------------------------------------------------
		// 2. AKSI: 1-KLIK TERBITKAN JURNAL KBM UNTUK PRESENSI TANPA JURNAL (create_jurnal)
		// -----------------------------------------------------------------------
		if (action === 'create_jurnal') {
			const { sesi_id, materi, kegiatan, metode = 'Ceramah' } = body;

			if (!sesi_id) {
				return NextResponse.json({ error: 'ID sesi presensi wajib disertakan.' }, { status: 400 });
			}

			const { data: session, error: sessErr } = await supabaseAdmin
				.from('absensi_mapel')
				.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap)')
				.eq('sesi_id', sesi_id)
				.maybeSingle();

			if (sessErr || !session) {
				return NextResponse.json({ error: 'Data sesi presensi tidak ditemukan.' }, { status: 404 });
			}

			const scheduleTimes = getExpectedScheduleTimes(session.jam_ke, session.tanggal);
			const jamMulai = scheduleTimes ? scheduleTimes.start : '07:15';
			const jamSelesai = scheduleTimes ? scheduleTimes.end : '08:35';
			const durasiMenit = calculateDurationMinutes(jamMulai, jamSelesai) || 80;

			const journalId = `jrn_${Math.random().toString(36).substring(2, 11)}`;
			const journalPayload = {
				id: journalId,
				guru_id: session.guru_id,
				tanggal: session.tanggal,
				jam_ke: session.jam_ke,
				pertemuan_ke: '1',
				kelas: session.kelas,
				mapel: session.mapel,
				materi: materi?.trim() || `KBM ${session.mapel} [Terbit dari Presensi]`,
				kegiatan: kegiatan?.trim() || `Kegiatan belajar mengajar ${session.mapel} di kelas ${session.kelas}`,
				metode,
				hambatan: '',
				solusi: '',
				tuntas: true,
				tahun_ajar: session.tahun_ajar || '',
				semester: session.semester || 1,
				jam_mulai: jamMulai,
				jam_selesai: jamSelesai,
				durasi_menit: durasiMenit,
				sesi_absensi_id: sesi_id,
				status_kehadiran: 'Normal',
				status_verifikasi: 'disetujui',
				catatan_admin: `Jurnal otomatis diterbitkan & disahkan oleh ${adminName} pada ${nowWib}.`,
			};

			let { data: insertedJournal, error: insertErr } = await supabaseAdmin
				.from('jurnal')
				.insert(journalPayload)
				.select();

			if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
				const fallback = { ...journalPayload };
				delete fallback.metode;
				delete fallback.jam_mulai;
				delete fallback.jam_selesai;
				delete fallback.durasi_menit;
				delete fallback.sesi_absensi_id;
				delete fallback.status_verifikasi;
				delete fallback.catatan_admin;
				const retry = await supabaseAdmin.from('jurnal').insert(fallback).select();
				insertedJournal = retry.data;
				insertErr = retry.error;
			}

			if (insertErr) throw insertErr;

			return NextResponse.json({
				success: true,
				message: 'Jurnal KBM berhasil diterbitkan dan otomatis disahkan.',
				data: insertedJournal ? insertedJournal[0] : journalPayload,
			});
		}

		// -----------------------------------------------------------------------
		// 3. AKSI: PECAH SESI (split_session)
		// -----------------------------------------------------------------------
		if (action === 'split_session') {
			const {
				sesi_id,
				sesi_1_jam,
				sesi_2_jam,
				siswa_alfa_ids = [],
			} = body;

			if (!sesi_id || !sesi_1_jam || !sesi_2_jam) {
				return NextResponse.json({ error: 'Parameter sesi_id, sesi_1_jam, dan sesi_2_jam wajib.' }, { status: 400 });
			}

			const { data: origSession, error: origErr } = await supabaseAdmin
				.from('absensi_mapel')
				.select('*')
				.eq('sesi_id', sesi_id)
				.maybeSingle();

			if (origErr || !origSession) {
				return NextResponse.json({ error: 'Sesi presensi asal tidak ditemukan.' }, { status: 404 });
			}

			// Ambil semua rincian siswa dari sesi 1
			const { data: origDetails } = await supabaseAdmin
				.from('absensi_mapel_siswa')
				.select('*')
				.eq('sesi_id', sesi_id);

			const normJam1 = normalizeJamKe(sesi_1_jam);
			const normJam2 = normalizeJamKe(sesi_2_jam);

			// 1. Update sesi 1 ke jam baru
			await supabaseAdmin
				.from('absensi_mapel')
				.update({
					jam_ke: normJam1,
					updated_at: new Date().toISOString(),
					catatan_admin: `Dipecah oleh Admin dari sesi jam ${origSession.jam_ke} menjadi slot ${normJam1}.`,
				})
				.eq('sesi_id', sesi_id);

			// 2. Buat sesi 2
			const newSesiId = `adm_${Math.random().toString(36).substring(2, 11)}`;
			const newSessionPayload = {
				sesi_id: newSesiId,
				guru_id: origSession.guru_id,
				tanggal: origSession.tanggal,
				jam_ke: normJam2,
				kelas: origSession.kelas,
				mapel: origSession.mapel,
				tahun_ajar: origSession.tahun_ajar,
				semester: origSession.semester,
				catatan_admin: `Hasil pemecahan sesi oleh Admin dari sesi jam ${origSession.jam_ke}.`,
				status_verifikasi: 'disetujui',
			};

			await supabaseAdmin.from('absensi_mapel').insert(newSessionPayload);

			// 3. Gandakan rincian siswa ke sesi 2 (dengan opsi alfa baru)
			const newDetails = (origDetails || []).map((d) => {
				const isAlfa = siswa_alfa_ids.includes(d.siswa_id);
				return {
					sesi_id: newSesiId,
					siswa_id: d.siswa_id,
					status: isAlfa ? 'alfa' : normStatus(d.status),
					keterangan: isAlfa ? 'Tidak kembali ke kelas di jam kedua' : (d.keterangan || ''),
				};
			});

			if (newDetails.length > 0) {
				await supabaseAdmin.from('absensi_mapel_siswa').insert(newDetails);
			}

			return NextResponse.json({
				success: true,
				message: `Sesi berhasil dipecah menjadi Jam ${normJam1} dan Jam ${normJam2}.`,
				sesi_1_id: sesi_id,
				sesi_2_id: newSesiId,
			});
		}

		return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
	} catch (error) {
		console.error('Error POST /api/admin/absensi/resolve:', error);
		return NextResponse.json({ error: error.message || 'Gagal memproses resolusi presensi.' }, { status: 500 });
	}
}
