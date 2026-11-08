import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normalizeJamKe, findConflictingSession, checkJamOverlap } from '@/lib/absensiUtils';
import { calculateDurationMinutes, getExpectedScheduleTimes } from '@/lib/kbmRealtimeUtils';
import { autoResolveFreedDrafts } from '@/lib/kbmConflictAutoResolver';

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
		const loadAssignments = searchParams.get('guru_assignments') === 'true';
		const conflictOnly = searchParams.get('conflict_only') === 'true';
		const kelas = searchParams.get('kelas');
		const guruId = searchParams.get('guru_id');
		const tanggal = searchParams.get('tanggal');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

		// 0. Ambil Pemetaan Penugasan Mengajar Guru (KBM, Jadwal, & Riwayat Jurnal)
		if (loadAssignments) {
			const targetGuruId = searchParams.get('guru_id');

			let kbmQuery = supabaseAdmin.from('guru_kbm').select('id_user, kelas, mapel');
			let jadwalQuery = supabaseAdmin.from('jadwal').select('id_user, kelas, mapel');
			let journalQuery = supabaseAdmin.from('jurnal').select('guru_id, kelas, mapel').limit(1500);

			if (targetGuruId) {
				kbmQuery = kbmQuery.eq('id_user', targetGuruId);
				jadwalQuery = jadwalQuery.eq('id_user', targetGuruId);
				journalQuery = journalQuery.eq('guru_id', targetGuruId);
			}

			const [kbmRes, jdwRes, jrnRes] = await Promise.all([
				kbmQuery.then((r) => r, () => ({ data: [] })),
				jadwalQuery.then((r) => r, () => ({ data: [] })),
				journalQuery.then((r) => r, () => ({ data: [] })),
			]);

			const assignmentsByGuru = {};
			const addEntry = (uid, k, m) => {
				if (!uid || !k || !m) return;
				const cleanKelas = String(k).trim();
				const cleanMapel = String(m).trim();
				if (!cleanKelas || !cleanMapel) return;

				if (!assignmentsByGuru[uid]) assignmentsByGuru[uid] = [];
				const exists = assignmentsByGuru[uid].some(
					(item) => item.kelas === cleanKelas && item.mapel === cleanMapel
				);
				if (!exists) {
					assignmentsByGuru[uid].push({ kelas: cleanKelas, mapel: cleanMapel });
				}
			};

			(kbmRes?.data || []).forEach((r) => addEntry(r.id_user, r.kelas, r.mapel));
			(jdwRes?.data || []).forEach((r) => addEntry(r.id_user, r.kelas, r.mapel));
			(jrnRes?.data || []).forEach((r) => addEntry(r.guru_id, r.kelas, r.mapel));

			return NextResponse.json({ success: true, assignments: assignmentsByGuru }, { status: 200 });
		}

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

			// Untuk setiap draft, cari data jurnal yang bentrok dan periksa apakah sudah bebas
			const conflictPairs = [];
			for (const draft of drafts || []) {
				// 1. Ambil semua KBM aktif di kelas & tanggal yang sama (bukan draft antrean)
				let activeJournals = [];
				if (draft.kelas && draft.tanggal) {
					const { data: classJournals } = await supabaseAdmin
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.eq('kelas', draft.kelas)
						.eq('tanggal', draft.tanggal)
						.neq('id', draft.id);

					activeJournals = (classJournals || []).filter(
						(j) => j.status_verifikasi !== 'draft_bentrok' && !String(j.status_kehadiran || '').toLowerCase().includes('draft bentrok')
					);
				}

				// 2. Cek apakah SAAT INI ada KBM aktif yang tumpang tindih dengan draft.jam_ke
				const currentActiveOverlap = activeJournals.find((j) => checkJamOverlap(j.jam_ke, draft.jam_ke).isOverlap);

				// 3. Ambil data konflik pembanding awal (berdasarkan draft.konflik_dengan_id)
				let originalConflict = null;
				if (draft.konflik_dengan_id) {
					const { data: cData } = await supabaseAdmin
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.eq('id', draft.konflik_dengan_id)
						.maybeSingle();
					originalConflict = cData;
				}

				const isStillConflict = !!currentActiveOverlap;
				const slotIsFree = !currentActiveOverlap;

				// 4. Susun pesan status resolusi untuk admin & guru
				let resolutionStatus = 'masih_bentrok';
				let resolutionNote = '';

				if (slotIsFree) {
					resolutionStatus = 'sudah_bebas';
					if (originalConflict) {
						const origGuru = originalConflict.users?.nama_lengkap || 'Guru lawan';
						if (originalConflict.kelas !== draft.kelas) {
							resolutionNote = `${origGuru} telah memindahkan KBM ke kelas ${originalConflict.kelas} (Jam ${originalConflict.jam_ke}). Kelas ${draft.kelas} di Jam ${draft.jam_ke} saat ini sudah bersih/bebas dan siap disahkan.`;
						} else if (originalConflict.jam_ke !== draft.jam_ke) {
							resolutionNote = `${origGuru} telah memindahkan KBM ke Jam ${originalConflict.jam_ke}. Slot Jam ${draft.jam_ke} saat ini sudah kosong dan siap disahkan.`;
						} else {
							resolutionNote = `Jadwal ${origGuru} sudah tidak lagi bertabrakan di kelas ${draft.kelas}. Slot Jam ${draft.jam_ke} saat ini sudah kosong dan siap disahkan.`;
						}
					} else if (draft.konflik_dengan_id) {
						resolutionNote = `Jurnal KBM lawan sebelumnya telah dihapus dari sistem. Slot Jam ${draft.jam_ke} saat ini sudah bebas dan aman.`;
					} else {
						resolutionNote = `Tidak ditemukan KBM aktif lain yang bertabrakan di Jam ${draft.jam_ke}. Slot sudah kosong dan siap disahkan.`;
					}
				} else {
					const overlapGuru = currentActiveOverlap.users?.nama_lengkap || 'Guru lain';
					resolutionNote = `Masih bertabrakan dengan KBM ${currentActiveOverlap.mapel} oleh ${overlapGuru} (Jam ${currentActiveOverlap.jam_ke}).`;
				}

				conflictPairs.push({
					id: draft.id,
					draft,
					conflictWith: currentActiveOverlap || originalConflict,
					activeOverlap: currentActiveOverlap || null,
					originalConflict: originalConflict || null,
					isStillConflict,
					slotIsFree,
					resolutionStatus,
					resolutionNote,
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
// POST: Input Jurnal Guru oleh Admin (Bantuan Kendala Teknis: HP Mati, Sinyal, dll)
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized, role, userId } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin atau Kurikulum.' }, { status: 403 });
		}

		const body = await req.json();
		const {
			guru_id,
			kelas,
			mapel,
			tanggal,
			jam_ke,
			pertemuan_ke,
			metode,
			materi,
			kegiatan,
			hambatan,
			solusi,
			tuntas,
			jam_mulai,
			jam_selesai,
			status_kehadiran,
			alasan_kendala,
			catatan_kendala,
			sync_absensi,
			override_conflict,
		} = body;

		if (!guru_id) {
			return NextResponse.json({ error: 'Guru pengajar wajib dipilih.' }, { status: 400 });
		}
		if (!kelas) {
			return NextResponse.json({ error: 'Kelas wajib dipilih.' }, { status: 400 });
		}
		if (!mapel) {
			return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 });
		}
		if (!tanggal) {
			return NextResponse.json({ error: 'Tanggal KBM wajib diisi.' }, { status: 400 });
		}
		if (!jam_ke) {
			return NextResponse.json({ error: 'Jam ke (JP) wajib diisi.' }, { status: 400 });
		}
		if (!materi || !materi.trim()) {
			return NextResponse.json({ error: 'Materi pembelajaran wajib diisi.' }, { status: 400 });
		}

		const normJam = normalizeJamKe(jam_ke);

		// Validasi Bentrok Jam Mengajar jika tidak di-override
		if (!override_conflict && tanggal && kelas && normJam) {
			const { data: classJournals } = await supabaseAdmin
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, status_verifikasi, status_kehadiran, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('kelas', kelas)
				.eq('tanggal', tanggal);

			const activeJournals = (classJournals || []).filter(
				(j) => j.status_verifikasi !== 'draft_bentrok' && !String(j.status_kehadiran || '').toLowerCase().includes('draft bentrok')
			);

			const conflict = findConflictingSession(activeJournals, normJam);
			if (conflict) {
				const guruExisting = conflict.session.users?.nama_lengkap || 'Guru lain';
				return NextResponse.json(
					{
						error: `Konflik: Jam ke-${normJam} di kelas ${kelas} bertabrakan dengan KBM ${conflict.session.mapel} oleh ${guruExisting} (Jam ${conflict.session.jam_ke}).`,
						conflict: {
							existingId: conflict.session.id,
							existingJamKe: conflict.session.jam_ke,
							existingGuru: guruExisting,
							existingMapel: conflict.session.mapel,
						},
						can_override: true,
					},
					{ status: 409 }
				);
			}
		}

		// Periode Akademik: jika tidak disediakan di body, ambil dari tabel tahun_ajar aktif
		let tahun_ajar = body.tahun_ajar;
		let semester = body.semester;
		if (!tahun_ajar || !semester) {
			const { data: taAktif } = await supabaseAdmin
				.from('tahun_ajar')
				.select('nama, semester')
				.eq('is_aktif', true)
				.maybeSingle();

			if (taAktif) {
				tahun_ajar = tahun_ajar || taAktif.nama;
				semester = semester || taAktif.semester;
			}
		}

		// Perhitungan Jam Mulai & Selesai serta Durasi (WIB)
		let finalJamMulai = jam_mulai ? String(jam_mulai).trim().slice(0, 8) : null;
		let finalJamSelesai = jam_selesai ? String(jam_selesai).trim().slice(0, 8) : null;

		// Jika jam mulai/selesai belum diisi, gunakan alokasi jam resmi sekolah
		if (!finalJamMulai || !finalJamSelesai) {
			const scheduleInfo = getExpectedScheduleTimes(normJam, tanggal);
			if (scheduleInfo) {
				if (!finalJamMulai) finalJamMulai = scheduleInfo.start;
				if (!finalJamSelesai) finalJamSelesai = scheduleInfo.end;
			}
		}

		let durasiMenit = body.durasi_menit !== undefined ? Number(body.durasi_menit) : 0;
		if (finalJamMulai && finalJamSelesai) {
			durasiMenit = calculateDurationMinutes(finalJamMulai, finalJamSelesai);
		}

		// Otomatis tautkan sesi_absensi_id jika ada data absensi_mapel di kelas, mapel, & tanggal ini
		let sesiAbsensiId = body.sesi_absensi_id || null;
		if (!sesiAbsensiId && tanggal && kelas && mapel) {
			try {
				const { data: matchedSessions } = await supabaseAdmin
					.from('absensi_mapel')
					.select('sesi_id, jam_ke')
					.eq('kelas', kelas)
					.eq('mapel', mapel)
					.eq('tanggal', tanggal)
					.order('created_at', { ascending: false });

				if (matchedSessions && matchedSessions.length > 0) {
					const exact = matchedSessions.find((s) => String(s.jam_ke).trim() === String(normJam).trim());
					sesiAbsensiId = exact ? exact.sesi_id : matchedSessions[0].sesi_id;
				}
			} catch (lookupErr) {
				console.warn('Gagal lookup sesi absensi mapel:', lookupErr);
			}
		}

		// Susun Catatan Audit Admin
		const nowWib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
		let adminName = role || 'Admin';
		if (userId) {
			const { data: u } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
			if (u?.nama_lengkap) adminName = u.nama_lengkap;
		}

		const labelKendala = alasan_kendala || 'Kendala Teknis (HP mati / tidak ada sinyal)';
		const extraKendala = catatan_kendala ? ` - ${catatan_kendala}` : '';
		const adminAudit = `Diinputkan oleh ${adminName} pada ${nowWib} [Bantuan Kendala: ${labelKendala}${extraKendala}]`;

		let finalHambatan = hambatan || '';
		if (labelKendala && !finalHambatan.toLowerCase().includes(labelKendala.toLowerCase())) {
			finalHambatan = finalHambatan ? `[${labelKendala}${extraKendala}] ${finalHambatan}` : `[${labelKendala}${extraKendala}]`;
		}

		const id = Math.random().toString(36).substring(2, 11);
		const insertPayload = {
			id,
			guru_id,
			tanggal,
			jam_ke: normJam,
			pertemuan_ke: pertemuan_ke ? String(pertemuan_ke) : '',
			kelas,
			mapel,
			materi: materi.trim(),
			kegiatan: kegiatan?.trim() || `KBM ${mapel} kelas ${kelas}`,
			metode: metode || 'Ceramah',
			hambatan: finalHambatan,
			solusi: solusi || '',
			tuntas: tuntas !== undefined ? !!tuntas : true,
			tahun_ajar: tahun_ajar || '',
			semester: semester ? parseInt(semester, 10) : 1,
			jam_mulai: finalJamMulai,
			jam_selesai: finalJamSelesai,
			durasi_menit: durasiMenit || 0,
			sesi_absensi_id: sesiAbsensiId,
			status_kehadiran: status_kehadiran || 'Normal',
			status_verifikasi: 'disetujui',
			catatan_admin: adminAudit,
		};

		// INSERT MENGGUNAKAN supabaseAdmin (Bypass RLS & Geofence)
		let { data: insertedRows, error: insertErr } = await supabaseAdmin
			.from('jurnal')
			.insert(insertPayload)
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)');

		// Fallback jika kolom baru belum ada di schema cache PostgREST
		if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
			const fallbackPayload = { ...insertPayload };
			delete fallbackPayload.metode;
			delete fallbackPayload.jam_mulai;
			delete fallbackPayload.jam_selesai;
			delete fallbackPayload.durasi_menit;
			delete fallbackPayload.sesi_absensi_id;
			delete fallbackPayload.status_kehadiran;
			delete fallbackPayload.status_verifikasi;
			delete fallbackPayload.konflik_dengan_id;
			delete fallbackPayload.catatan_admin;

			if (insertPayload.metode && !fallbackPayload.kegiatan.includes('[Metode:')) {
				fallbackPayload.kegiatan = `[Metode: ${insertPayload.metode}] ${fallbackPayload.kegiatan}`.trim();
			}

			const retry = await supabaseAdmin
				.from('jurnal')
				.insert(fallbackPayload)
				.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)');
			insertErr = retry.error;
			insertedRows = retry.data;
		}

		if (insertErr) throw insertErr;

		// Sinkronisasi ke absensi_mapel jika diminta
		if (sync_absensi && sesiAbsensiId) {
			try {
				await supabaseAdmin
					.from('absensi_mapel')
					.update({
						jam_ke: normJam,
						kelas,
						mapel,
						guru_id,
					})
					.eq('sesi_id', sesiAbsensiId);
			} catch (syncErr) {
				console.warn('Gagal sinkronisasi absensi_mapel:', syncErr);
			}
		}

		return NextResponse.json(
			{
				success: true,
				message: 'Jurnal guru berhasil diinput dan langsung disahkan oleh Admin.',
				data: insertedRows ? insertedRows[0] : insertPayload,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error POST /api/admin/jurnal:', error);
		return NextResponse.json({ error: error.message || 'Gagal menyimpan jurnal guru.' }, { status: 500 });
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

		// Auto-upgrade status jika jurnal sebelumnya berstatus draft_bentrok dan kini disimpan tanpa bentrok
		if (
			existingData?.status_verifikasi === 'draft_bentrok' ||
			String(existingData?.status_kehadiran || '').toLowerCase().includes('draft bentrok')
		) {
			updates.status_verifikasi = 'disetujui';
			if (!updates.status_kehadiran || updates.status_kehadiran === 'Draft Bentrok') {
				updates.status_kehadiran = 'Normal';
			}
			updates.konflik_dengan_id = null;
			const nowStr = new Date().toLocaleString('id-ID');
			updates.catatan_admin = `Disahkan oleh Admin pada ${nowStr} (Data KBM disesuaikan ke ${targetKelas} ${targetTanggal} Jam ${targetJamKe} dan diverifikasi bebas dari bentrok).`;
		} else {
			// Tambahkan catatan audit admin biasa
			updates.catatan_admin = updates.catatan_admin || `Diperbarui oleh Admin (${new Date().toLocaleString('id-ID')})`;
		}

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

		// Otomatis cek & sahkan draft antrean rekan yang sebelumnya terblokir jika kelas/jam KBM ini dipindahkan
		await autoResolveFreedDrafts({
			sourceJournalId: id,
			oldData: existingData,
			newData: { kelas: targetKelas, jam_ke: targetJamKe },
			actionType: 'update',
		});

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

		// Ambil data untuk cek sesi_absensi_id dan auto-resolusi draft rekan
		const { data: journal } = await supabaseAdmin
			.from('jurnal')
			.select('id, sesi_absensi_id, kelas, mapel, tanggal, jam_ke, guru_id')
			.eq('id', id)
			.maybeSingle();

		const { error: delErr } = await supabaseAdmin.from('jurnal').delete().eq('id', id);
		if (delErr) throw delErr;

		// Otomatis bebaskan draft antrean yang sebelumnya terhalang oleh jurnal ini
		if (journal) {
			await autoResolveFreedDrafts({
				sourceJournalId: id,
				oldData: journal,
				actionType: 'delete',
			});
		}

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
