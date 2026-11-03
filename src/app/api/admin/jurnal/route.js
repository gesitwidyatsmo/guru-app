import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normalizeJamKe, findConflictingSession, checkJamOverlap } from '@/lib/absensiUtils';

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
// GET: Ambil Daftar Jurnal untuk Admin (Mendukung Filter Khusus Bentrok)
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin atau Kurikulum.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const conflictOnly = searchParams.get('conflict_only') === 'true';
		const kelas = searchParams.get('kelas');
		const guruId = searchParams.get('guru_id');
		const tanggal = searchParams.get('tanggal');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

		// 1. Jika mode conflict_only: prioritaskan ambil antrean draft_bentrok dan cari pasangannya
		if (conflictOnly) {
			let draftQuery = supabaseAdmin
				.from('jurnal')
				.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
				.or('status_verifikasi.eq.draft_bentrok,status_kehadiran.ilike.%Draft Bentrok%')
				.order('created_at', { ascending: false });

			if (tanggal) draftQuery = draftQuery.eq('tanggal', tanggal);
			if (kelas) draftQuery = draftQuery.eq('kelas', kelas);

			const { data: drafts, error: draftErr } = await draftQuery;
			if (draftErr) throw draftErr;

			// Untuk setiap draft, cari data jurnal yang bentrok
			const conflictPairs = [];
			for (const draft of drafts || []) {
				let conflictJournal = null;

				// A. Cek berdasarkan konflik_dengan_id
				if (draft.konflik_dengan_id) {
					const { data: cData } = await supabaseAdmin
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.eq('id', draft.konflik_dengan_id)
						.maybeSingle();
					conflictJournal = cData;
				}

				// B. Fallback: Cari sesi aktif di kelas & tanggal yang sama yang overlap jamnya
				if (!conflictJournal && draft.kelas && draft.tanggal) {
					const { data: classJournals } = await supabaseAdmin
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.eq('kelas', draft.kelas)
						.eq('tanggal', draft.tanggal)
						.neq('id', draft.id);

					const activeJournals = (classJournals || []).filter(
						(j) => j.status_verifikasi !== 'draft_bentrok' && j.status_kehadiran !== 'Draft Bentrok'
					);

					const match = activeJournals.find((j) => checkJamOverlap(j.jam_ke, draft.jam_ke).isOverlap);
					if (match) conflictJournal = match;
				}

				conflictPairs.push({
					id: draft.id,
					draft,
					conflictWith: conflictJournal,
				});
			}

			return NextResponse.json({
				success: true,
				count: conflictPairs.length,
				conflicts: conflictPairs,
			}, { status: 200 });
		}

		// 2. Mode Biasa: Ambil daftar seluruh jurnal dengan filter fleksibel
		let query = supabaseAdmin
			.from('jurnal')
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
			.order('tanggal', { ascending: false })
			.order('created_at', { ascending: false });

		if (kelas && kelas !== 'all' && kelas !== 'Semua') query = query.eq('kelas', kelas);
		if (guruId && guruId !== 'all' && guruId !== 'Semua') query = query.eq('guru_id', guruId);
		if (tanggal) query = query.eq('tanggal', tanggal);
		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester, 10));

		const { data: journals, error } = await query;
		if (error) throw error;

		return NextResponse.json(journals || [], { status: 200 });
	} catch (error) {
		console.error('Error GET /api/admin/jurnal:', error);
		return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// PUT: Edit Mandiri Jurnal oleh Admin (Dapat mengubah jam, guru, kelas, mapel)
// ---------------------------------------------------------------------------
export async function PUT(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const { id, sync_absensi, override_conflict, ...updates } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID Jurnal wajib disertakan.' }, { status: 400 });
		}

		// Ambil data eksisting menggunakan supabaseAdmin untuk bypass RLS
		const { data: existingData, error: fetchErr } = await supabaseAdmin
			.from('jurnal')
			.select('*')
			.eq('id', id)
			.maybeSingle();

		if (fetchErr || !existingData) {
			return NextResponse.json({ error: 'Jurnal tidak ditemukan di database.' }, { status: 404 });
		}

		if (updates.jam_ke !== undefined) updates.jam_ke = normalizeJamKe(updates.jam_ke);

		// Validasi bentrok jika tidak di-override
		const targetTanggal = updates.tanggal || existingData.tanggal;
		const targetKelas = updates.kelas || existingData.kelas;
		const targetJamKe = updates.jam_ke || existingData.jam_ke;

		if (!override_conflict && targetTanggal && targetKelas && targetJamKe) {
			const { data: classJournals } = await supabaseAdmin
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, status_verifikasi, status_kehadiran, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('kelas', targetKelas)
				.eq('tanggal', targetTanggal)
				.neq('id', id);

			const activeJournals = (classJournals || []).filter(
				(j) => j.status_verifikasi !== 'draft_bentrok' && j.status_kehadiran !== 'Draft Bentrok'
			);

			const conflict = findConflictingSession(activeJournals, targetJamKe);
			if (conflict) {
				const guruExisting = conflict.session.users?.nama_lengkap || 'Guru lain';
				return NextResponse.json({
					error: `Konflik: Jam ke-${targetJamKe} bertabrakan dengan KBM ${conflict.session.mapel} oleh ${guruExisting} (Jam ${conflict.session.jam_ke}).`,
					conflict: {
						existingId: conflict.session.id,
						existingJamKe: conflict.session.jam_ke,
						existingGuru: guruExisting,
					},
					can_override: true,
				}, { status: 409 });
			}
		}

		// Tambahkan catatan audit admin
		updates.catatan_admin = updates.catatan_admin || `Diperbarui oleh Admin (${new Date().toLocaleString('id-ID')})`;

		// Bersihkan field relasi join atau non-kolom agar tidak error PostgreSQL
		delete updates.users;
		delete updates.created_at;
		delete updates.id;

		// UPDATE MENGGUNAKAN supabaseAdmin (Service Role) - Bebas dari hambatan RLS
		let { data: updatedRows, error: updateErr } = await supabaseAdmin
			.from('jurnal')
			.update(updates)
			.eq('id', id)
			.select();

		// Fallback jika kolom baru belum ada di schema cache PostgREST
		if (updateErr && (updateErr.code === 'PGRST204' || updateErr.code === '42703')) {
			const fallbackUpdates = { ...updates };
			delete fallbackUpdates.status_verifikasi;
			delete fallbackUpdates.konflik_dengan_id;
			delete fallbackUpdates.catatan_admin;
			const retry = await supabaseAdmin.from('jurnal').update(fallbackUpdates).eq('id', id).select();
			updateErr = retry.error;
			updatedRows = retry.data;
		}

		if (updateErr) throw updateErr;

		if (!updatedRows || updatedRows.length === 0) {
			return NextResponse.json({ error: 'Data jurnal tidak ditemukan untuk diperbarui.' }, { status: 404 });
		}

		// Sinkronisasi ke absensi_mapel
		if (sync_absensi && updates.jam_ke) {
			try {
				const sesiId = updates.sesi_absensi_id || existingData.sesi_absensi_id;
				if (sesiId) {
					await supabaseAdmin
						.from('absensi_mapel')
						.update({
							jam_ke: updates.jam_ke,
							kelas: targetKelas,
							mapel: updates.mapel || existingData.mapel,
						})
						.eq('sesi_id', sesiId);
				} else {
					const mapelTarget = updates.mapel || existingData.mapel;
					await supabaseAdmin
						.from('absensi_mapel')
						.update({ jam_ke: updates.jam_ke })
						.eq('tanggal', targetTanggal)
						.eq('kelas', targetKelas)
						.eq('mapel', mapelTarget);
				}
			} catch (syncErr) {
				console.warn('Gagal sinkronisasi absensi_mapel:', syncErr);
			}
		}

		return NextResponse.json({
			success: true,
			message: 'Jurnal berhasil diperbarui oleh Admin.',
			data: updatedRows[0],
		}, { status: 200 });
	} catch (error) {
		console.error('Error PUT /api/admin/jurnal:', error);
		return NextResponse.json({ error: error.message || 'Gagal update jurnal.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// DELETE: Hapus Jurnal oleh Admin (Termasuk Opsi Hapus Absensi Siswa Terkait)
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');
		const deleteAbsensi = searchParams.get('delete_absensi') === 'true';

		if (!id) {
			return NextResponse.json({ error: 'ID Jurnal diperlukan.' }, { status: 400 });
		}

		// Ambil data untuk cek sesi_absensi_id
		const { data: journal } = await supabaseAdmin
			.from('jurnal')
			.select('sesi_absensi_id, kelas, mapel, tanggal')
			.eq('id', id)
			.maybeSingle();

		const { error: delErr } = await supabaseAdmin.from('jurnal').delete().eq('id', id);
		if (delErr) throw delErr;

		if (deleteAbsensi && journal) {
			try {
				if (journal.sesi_absensi_id) {
					await supabaseAdmin.from('absensi_mapel_siswa').delete().eq('sesi_id', journal.sesi_absensi_id);
					await supabaseAdmin.from('absensi_mapel').delete().eq('sesi_id', journal.sesi_absensi_id);
				} else {
					// Hapus sesi mapel yang cocok
					const { data: sesiList } = await supabaseAdmin
						.from('absensi_mapel')
						.select('sesi_id')
						.eq('kelas', journal.kelas)
						.eq('mapel', journal.mapel)
						.eq('tanggal', journal.tanggal);

					for (const s of sesiList || []) {
						await supabaseAdmin.from('absensi_mapel_siswa').delete().eq('sesi_id', s.sesi_id);
						await supabaseAdmin.from('absensi_mapel').delete().eq('sesi_id', s.sesi_id);
					}
				}
			} catch (absErr) {
				console.warn('Gagal hapus absensi terkait:', absErr);
			}
		}

		return NextResponse.json({ success: true, message: 'Jurnal berhasil dihapus.' });
	} catch (error) {
		console.error('Error DELETE /api/admin/jurnal:', error);
		return NextResponse.json({ error: error.message || 'Gagal menghapus jurnal.' }, { status: 500 });
	}
}
