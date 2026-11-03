import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normalizeJamKe } from '@/lib/absensiUtils';

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
		const { data: { user } } = await supabase.auth.getUser();
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
// POST: Resolusi Konflik Bentrok Jam Jurnal KBM (1-Klik Auto-Resolve)
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const {
			draft_id,
			conflict_id,
			action = 'adjust_and_approve',
			guru_a_update = {},
			guru_b_update = {},
			sync_absensi = true,
		} = body;

		if (!draft_id) {
			return NextResponse.json({ error: 'draft_id wajib disertakan.' }, { status: 400 });
		}

		// 1. Ambil data Draft Guru B menggunakan supabaseAdmin
		const { data: draftData, error: draftErr } = await supabaseAdmin
			.from('jurnal')
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap)')
			.eq('id', draft_id)
			.maybeSingle();

		if (draftErr || !draftData) {
			return NextResponse.json({ error: 'Data draft KBM tidak ditemukan.' }, { status: 404 });
		}

		// 2. Ambil data Konflik Guru A (jika ada conflict_id) menggunakan supabaseAdmin
		let conflictData = null;
		const targetConflictId = conflict_id || draftData.konflik_dengan_id;
		if (targetConflictId) {
			const { data: cData } = await supabaseAdmin
				.from('jurnal')
				.select('*, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('id', targetConflictId)
				.maybeSingle();
			conflictData = cData;
		}

		const nowStr = new Date().toLocaleString('id-ID');

		// -----------------------------------------------------------------------
		// AKSI: TOLAK DRAFT
		// -----------------------------------------------------------------------
		if (action === 'reject_draft') {
			const { error: rejectErr } = await supabaseAdmin
				.from('jurnal')
				.update({
					status_verifikasi: 'ditolak',
					status_kehadiran: 'Ditolak Admin',
					catatan_admin: `Ditolak oleh Admin pada ${nowStr}.`,
				})
				.eq('id', draft_id);

			if (rejectErr) throw rejectErr;
			return NextResponse.json({ success: true, message: 'Draft KBM berhasil ditolak.' });
		}

		// -----------------------------------------------------------------------
		// AKSI: HAPUS JURNAL KONFLIK (DUPLIKAT) & SAHKAN DRAFT
		// -----------------------------------------------------------------------
		if (action === 'delete_conflict_and_approve' && targetConflictId) {
			await supabaseAdmin.from('jurnal').delete().eq('id', targetConflictId);

			const approvePayload = {
				status_verifikasi: 'disetujui',
				status_kehadiran: 'Normal',
				catatan_admin: `Disahkan oleh Admin pada ${nowStr} (Jurnal lawan dihapus karena duplikat).`,
			};
			if (guru_b_update.jam_ke) approvePayload.jam_ke = normalizeJamKe(guru_b_update.jam_ke);

			const { error: appErr } = await supabaseAdmin.from('jurnal').update(approvePayload).eq('id', draft_id);
			if (appErr) throw appErr;

			return NextResponse.json({ success: true, message: 'Jurnal duplikat dihapus dan KBM berhasil disahkan.' });
		}

		// -----------------------------------------------------------------------
		// AKSI UTAMA: PENYESUAIAN JAM GURU A & SAHKAN DRAFT GURU B
		// (Menangani Pergeseran Jam: 4-5 jadi 3-4, maupun Pangkas Jam: 1-4 jadi 1-2)
		// -----------------------------------------------------------------------
		if (conflictData && targetConflictId) {
			const newJamGuruA = guru_a_update.jam_ke ? normalizeJamKe(guru_a_update.jam_ke) : conflictData.jam_ke;
			const newKelasGuruA = guru_a_update.kelas || conflictData.kelas;

			const updatePayloadGuruA = {
				jam_ke: newJamGuruA,
				kelas: newKelasGuruA,
				catatan_admin: `Jam disesuaikan dari ${conflictData.jam_ke} ke ${newJamGuruA} oleh Admin (${nowStr}) untuk membuka slot KBM.`,
			};

			const { error: updErrA } = await supabaseAdmin.from('jurnal').update(updatePayloadGuruA).eq('id', targetConflictId);
			if (updErrA) throw updErrA;

			// Sinkronisasi absensi_mapel Guru A jika diminta
			if (sync_absensi && newJamGuruA !== conflictData.jam_ke) {
				try {
					if (conflictData.sesi_absensi_id) {
						await supabaseAdmin
							.from('absensi_mapel')
							.update({ jam_ke: newJamGuruA, kelas: newKelasGuruA })
							.eq('sesi_id', conflictData.sesi_absensi_id);
					} else {
						await supabaseAdmin
							.from('absensi_mapel')
							.update({ jam_ke: newJamGuruA, kelas: newKelasGuruA })
							.eq('tanggal', conflictData.tanggal)
							.eq('kelas', conflictData.kelas)
							.eq('mapel', conflictData.mapel);
					}
				} catch (syncErr) {
					console.warn('Gagal sinkronisasi absensi Guru A:', syncErr);
				}
			}
		}

		// Sahkan Draft Guru B
		const newJamGuruB = guru_b_update.jam_ke ? normalizeJamKe(guru_b_update.jam_ke) : draftData.jam_ke;
		const approvePayload = {
			jam_ke: newJamGuruB,
			status_verifikasi: 'disetujui',
			status_kehadiran: 'Normal',
			catatan_admin: `Disahkan oleh Admin pada ${nowStr}.`,
		};

		const { error: updErrB } = await supabaseAdmin.from('jurnal').update(approvePayload).eq('id', draft_id);
		if (updErrB) throw updErrB;

		// Sinkronisasi absensi_mapel Guru B jika ada sesi tersimpan
		if (sync_absensi && draftData.sesi_absensi_id) {
			try {
				await supabaseAdmin.from('absensi_mapel').update({ jam_ke: newJamGuruB }).eq('sesi_id', draftData.sesi_absensi_id);
			} catch (syncErrB) {
				console.warn('Gagal sinkronisasi absensi Guru B:', syncErrB);
			}
		}

		return NextResponse.json({
			success: true,
			message: `Konflik berhasil diselesaikan! Jam Guru A disesuaikan ke ${guru_a_update.jam_ke || 'jam baru'} dan KBM Guru B resmi disahkan.`,
		});
	} catch (error) {
		console.error('Error POST /api/admin/jurnal/resolve:', error);
		return NextResponse.json({ error: error.message || 'Gagal menyelesaikan konflik.' }, { status: 500 });
	}
}
