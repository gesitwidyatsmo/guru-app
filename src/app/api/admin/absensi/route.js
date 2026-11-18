import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import {
	normalizeJamKe,
	checkJamOverlap,
	calculateAttendanceSummary,
	normStatus,
} from '@/lib/absensiUtils';
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

/**
 * Mengambil seluruh data jurnal secara terpaginasi (melewati limit 1000 baris PostgREST)
 * Terurut tanggal DESC sehingga jurnal terbaru selalu dimuat terlebih dahulu.
 */
async function getAllJournals(filter = {}) {
	let allJournals = [];
	let page = 0;
	const pageSize = 1000;

	while (true) {
		let q = supabaseAdmin
			.from('jurnal')
			.select('id, sesi_absensi_id, kelas, mapel, tanggal, jam_ke, guru_id, status_verifikasi')
			.order('tanggal', { ascending: false })
			.order('created_at', { ascending: false })
			.range(page * pageSize, (page + 1) * pageSize - 1);

		if (filter.tanggal) q = q.eq('tanggal', filter.tanggal);
		if (filter.startDate) q = q.gte('tanggal', filter.startDate);
		if (filter.endDate) q = q.lte('tanggal', filter.endDate);
		if (filter.kelas && filter.kelas !== 'all' && filter.kelas !== 'Semua') q = q.eq('kelas', filter.kelas);
		if (filter.mapel && filter.mapel !== 'all' && filter.mapel !== 'Semua') q = q.eq('mapel', filter.mapel);
		if (filter.guruId && filter.guruId !== 'all' && filter.guruId !== 'Semua') q = q.eq('guru_id', filter.guruId);

		const { data, error } = await q;
		if (error) {
			console.error('Error fetching journals page in getAllJournals:', error);
			break;
		}
		if (!data || data.length === 0) break;
		allJournals.push(...data);
		if (data.length < pageSize) break;
		page++;
		if (page >= 15) break; // safety ceiling (hingga 15.000 jurnal)
	}

	return allJournals;
}

/**
 * Mengambil seluruh sesi absensi secara terpaginasi (melewati limit 1000 baris PostgREST)
 */
async function getAllSessions(selectStr, filter = {}) {
	let allSessions = [];
	let page = 0;
	const pageSize = 1000;

	while (true) {
		let q = supabaseAdmin
			.from('absensi_mapel')
			.select(selectStr)
			.order('tanggal', { ascending: false })
			.order('created_at', { ascending: false })
			.range(page * pageSize, (page + 1) * pageSize - 1);

		if (filter.kelas && filter.kelas !== 'all' && filter.kelas !== 'Semua') q = q.eq('kelas', filter.kelas);
		if (filter.mapel && filter.mapel !== 'all' && filter.mapel !== 'Semua') q = q.eq('mapel', filter.mapel);
		if (filter.guruId && filter.guruId !== 'all' && filter.guruId !== 'Semua') q = q.eq('guru_id', filter.guruId);
		if (filter.tanggal) q = q.eq('tanggal', filter.tanggal);
		if (filter.startDate) q = q.gte('tanggal', filter.startDate);
		if (filter.endDate) q = q.lte('tanggal', filter.endDate);
		if (filter.tahunAjar) q = q.eq('tahun_ajar', filter.tahunAjar);
		if (filter.semester) q = q.eq('semester', parseInt(filter.semester, 10));

		const { data, error } = await q;
		if (error) {
			console.error('Error fetching sessions page in getAllSessions:', error);
			throw error;
		}
		if (!data || data.length === 0) break;
		allSessions.push(...data);
		if (data.length < pageSize) break;
		page++;
		if (page >= 15) break;
	}

	return allSessions;
}

/**
 * Mencocokkan sesi absensi dengan entri jurnal KBM:
 * 1. Prioritas 1: Cocok langsung via ID sesi_absensi_id di tabel jurnal.
 * 2. Prioritas 2: Cocok natural key (tanggal + kelas + mapel + normalized jam_ke).
 * 3. Prioritas 3: Cocok tanggal + kelas + mapel dengan jam_ke yang tumpang tindih (overlap).
 */
function findMatchingJournal(session, journalMap, allJournals) {
	if (journalMap.has(session.sesi_id)) {
		return journalMap.get(session.sesi_id);
	}

	const normS = normalizeJamKe(session.jam_ke);
	const naturalKey = `${session.tanggal}_${session.kelas}_${session.mapel}_${normS}`;
	if (journalMap.has(naturalKey)) {
		return journalMap.get(naturalKey);
	}

	const overlapMatch = allJournals.find((j) => {
		if (j.tanggal === session.tanggal && j.kelas === session.kelas && j.mapel === session.mapel) {
			const normJ = normalizeJamKe(j.jam_ke);
			return checkJamOverlap(normS, normJ).isOverlap;
		}
		return false;
	});

	return overlapMatch || null;
}

// ---------------------------------------------------------------------------
// GET: Ambil Data Presensi untuk Admin (List, Radar Bentrok, & Anomali)
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin atau Kurikulum.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const loadAssignments = searchParams.get('teacher_assignments') === 'true';
		const radarMode = searchParams.get('radar') === 'true' || searchParams.get('conflict_only') === 'true';
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const guruId = searchParams.get('guru_id');
		const tanggal = searchParams.get('tanggal');
		const startDate = searchParams.get('startDate') || searchParams.get('start_date');
		const endDate = searchParams.get('endDate') || searchParams.get('end_date');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');
		const includeStudents = searchParams.get('include_students') === 'true';

		// 0. Ambil Pemetaan Penugasan Mengajar Guru (KBM, Jadwal, & Absensi)
		if (loadAssignments) {
			const targetGuruId = searchParams.get('guru_id');

			let kbmQuery = supabaseAdmin.from('guru_kbm').select('id_user, kelas, mapel');
			let jadwalQuery = supabaseAdmin.from('jadwal').select('id_user, kelas, mapel');
			let absQuery = supabaseAdmin.from('absensi_mapel').select('guru_id, kelas, mapel').limit(1500);

			if (targetGuruId) {
				kbmQuery = kbmQuery.eq('id_user', targetGuruId);
				jadwalQuery = jadwalQuery.eq('id_user', targetGuruId);
				absQuery = absQuery.eq('guru_id', targetGuruId);
			}

			const [kbmRes, jdwRes, absRes] = await Promise.all([
				kbmQuery.then((r) => r, () => ({ data: [] })),
				jadwalQuery.then((r) => r, () => ({ data: [] })),
				absQuery.then((r) => r, () => ({ data: [] })),
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
			(absRes?.data || []).forEach((r) => addEntry(r.guru_id, r.kelas, r.mapel));

			return NextResponse.json({ success: true, assignments: assignmentsByGuru }, { status: 200 });
		}

		// 1. Mode Radar: Deteksi Bentrok Jam Mengajar & Presensi Tanpa Jurnal KBM
		if (radarMode) {
			const radarFilter = {};
			if (tanggal) radarFilter.tanggal = tanggal;
			if (kelas && kelas !== 'all' && kelas !== 'Semua') radarFilter.kelas = kelas;

			const radarSelect = `
				*,
				users!absensi_mapel_guru_id_fkey(nama_lengkap, username),
				absensi_mapel_siswa(id, status, keterangan, siswa_id)
			`;

			const [sessions, journals] = await Promise.all([
				getAllSessions(radarSelect, radarFilter),
				getAllJournals(radarFilter),
			]);

			const journalMap = new Map();
			journals.forEach((j) => {
				if (j.sesi_absensi_id) {
					journalMap.set(j.sesi_absensi_id, j);
				}
				const normJ = normalizeJamKe(j.jam_ke);
				const key = `${j.tanggal}_${j.kelas}_${j.mapel}_${normJ}`;
				if (!journalMap.has(key)) journalMap.set(key, j);
			});

			// Evaluasi Bentrok (Konflik Jam Tumpang Tindih di Kelas & Tanggal yang sama)
			const conflicts = [];
			const seenPairs = new Set();

			for (let i = 0; i < sessions.length; i++) {
				for (let j = i + 1; j < sessions.length; j++) {
					const s1 = sessions[i];
					const s2 = sessions[j];

					if (s1.tanggal === s2.tanggal && s1.kelas === s2.kelas) {
						const { isOverlap } = checkJamOverlap(s1.jam_ke, s2.jam_ke);
						if (isOverlap) {
							const pairKey = [s1.sesi_id, s2.sesi_id].sort().join('_');
							if (!seenPairs.has(pairKey)) {
								seenPairs.add(pairKey);
								conflicts.push({
									id: pairKey,
									tanggal: s1.tanggal,
									kelas: s1.kelas,
									sessionA: {
										...s1,
										guru_nama: s1.users?.nama_lengkap || 'Guru A',
									},
									sessionB: {
										...s2,
										guru_nama: s2.users?.nama_lengkap || 'Guru B',
									},
									reason: `Presensi ${s1.mapel} (Jam ${s1.jam_ke}) bertabrakan dengan ${s2.mapel} (Jam ${s2.jam_ke}) di kelas ${s1.kelas}.`,
								});
							}
						}
					}
				}
			}

			// Evaluasi Presensi Tanpa Jurnal KBM
			const unlinked = [];
			const anomali = [];

			for (const s of sessions) {
				const matchingJournal = findMatchingJournal(s, journalMap, journals);

				const studentDetails = s.absensi_mapel_siswa || [];
				const summary = calculateAttendanceSummary(studentDetails);

				const enriched = {
					...s,
					guru_nama: s.users?.nama_lengkap || 'Guru',
					summary,
					has_jurnal: !!matchingJournal,
					jurnal_id: matchingJournal ? matchingJournal.id : null,
					jurnal_status: matchingJournal ? matchingJournal.status_verifikasi : 'belum_ada',
				};

				if (!matchingJournal) {
					unlinked.push(enriched);
				}

				// Deteksi anomali ketidakhadiran tinggi (misal: > 25% siswa tidak hadir)
				if (summary.total > 0) {
					const absentCount = summary.sakit + summary.izin + summary.alfa;
					const absentRatio = absentCount / summary.total;
					if (absentRatio >= 0.25 || summary.alfa >= 3) {
						anomali.push({
							...enriched,
							absentCount,
							absentRatio: Math.round(absentRatio * 100),
							alfaCount: summary.alfa,
						});
					}
				}
			}

			return NextResponse.json({
				success: true,
				summary: {
					total_sessions: sessions.length,
					conflicts_count: conflicts.length,
					unlinked_count: unlinked.length,
					anomali_count: anomali.length,
				},
				conflicts,
				unlinked,
				anomali,
			}, { status: 200 });
		}

		// 2. Mode Biasa: Ambil Seluruh Daftar Presensi dengan Relasi Siswa Langsung
		const selectStr = includeStudents
			? '*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username), absensi_mapel_siswa(id, status, keterangan, siswa_id, siswa(id, nama_lengkap, nis))'
			: '*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username), absensi_mapel_siswa(id, status, keterangan, siswa_id)';

		const sessionFilter = {};
		if (kelas && kelas !== 'all' && kelas !== 'Semua') sessionFilter.kelas = kelas;
		if (mapel && mapel !== 'all' && mapel !== 'Semua') sessionFilter.mapel = mapel;
		if (guruId && guruId !== 'all' && guruId !== 'Semua') sessionFilter.guruId = guruId;
		if (tanggal) sessionFilter.tanggal = tanggal;
		if (startDate) sessionFilter.startDate = startDate;
		if (endDate) sessionFilter.endDate = endDate;
		if (tahunAjar) sessionFilter.tahunAjar = tahunAjar;
		if (semester) sessionFilter.semester = semester;

		const journalFilter = {};
		if (tanggal) journalFilter.tanggal = tanggal;
		if (startDate) journalFilter.startDate = startDate;
		if (endDate) journalFilter.endDate = endDate;
		if (kelas && kelas !== 'all' && kelas !== 'Semua') journalFilter.kelas = kelas;

		const [sessions, journals] = await Promise.all([
			getAllSessions(selectStr, sessionFilter),
			getAllJournals(journalFilter),
		]);

		const journalMap = new Map();
		journals.forEach((j) => {
			if (j.sesi_absensi_id) journalMap.set(j.sesi_absensi_id, j);
			const normJ = normalizeJamKe(j.jam_ke);
			const key = `${j.tanggal}_${j.kelas}_${j.mapel}_${normJ}`;
			if (!journalMap.has(key)) journalMap.set(key, j);
		});

		const enrichedSessions = sessions.map((s) => {
			const studentDetails = s.absensi_mapel_siswa || [];
			const summary = calculateAttendanceSummary(studentDetails);

			const matchingJournal = findMatchingJournal(s, journalMap, journals);

			return {
				id: s.sesi_id,
				sesi_id: s.sesi_id,
				guru_id: s.guru_id,
				guru_nama: s.users?.nama_lengkap || 'Guru',
				kelas: s.kelas,
				mapel: s.mapel,
				tanggal: s.tanggal,
				jam_ke: s.jam_ke,
				created_at: s.created_at,
				updated_at: s.updated_at,
				waktu_absen: s.waktu_absen,
				tahun_ajar: s.tahun_ajar,
				semester: s.semester,
				catatan_admin: s.catatan_admin || null,
				has_jurnal: !!matchingJournal,
				jurnal_id: matchingJournal ? matchingJournal.id : null,
				jurnal_status: matchingJournal ? matchingJournal.status_verifikasi : 'belum_ada',
				summary,
				siswa_count: studentDetails.length,
				data_absensi: includeStudents ? studentDetails : undefined,
			};
		});

		return NextResponse.json(enrichedSessions, { status: 200 });
	} catch (error) {
		console.error('Error GET /api/admin/absensi:', error);
		return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// POST: Input Presensi Guru oleh Admin (Bantuan Kendala Teknis: HP Mati, dsb)
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
			absensiList,
			alasan_kendala,
			catatan_kendala,
			sync_jurnal = true,
			override_conflict = false,
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
			return NextResponse.json({ error: 'Tanggal presensi wajib diisi.' }, { status: 400 });
		}
		if (!jam_ke) {
			return NextResponse.json({ error: 'Jam ke (JP) wajib diisi.' }, { status: 400 });
		}
		if (!absensiList || !Array.isArray(absensiList) || absensiList.length === 0) {
			return NextResponse.json({ error: 'Daftar kehadiran siswa tidak boleh kosong.' }, { status: 400 });
		}

		const normJam = normalizeJamKe(jam_ke);

		// Validasi Bentrok Jam Presensi jika tidak di-override
		if (!override_conflict && tanggal && kelas && normJam) {
			const { data: existingSessions } = await supabaseAdmin
				.from('absensi_mapel')
				.select('sesi_id, jam_ke, mapel, guru_id, users!absensi_mapel_guru_id_fkey(nama_lengkap)')
				.eq('kelas', kelas)
				.eq('tanggal', tanggal);

			if (existingSessions && existingSessions.length > 0) {
				for (const s of existingSessions) {
					const { isOverlap } = checkJamOverlap(s.jam_ke, normJam);
					if (isOverlap) {
						const guruExisting = s.users?.nama_lengkap || 'Guru lain';
						return NextResponse.json(
							{
								error: `Konflik: Jam ke-${normJam} di kelas ${kelas} bertabrakan dengan presensi ${s.mapel} oleh ${guruExisting} (Jam ${s.jam_ke}).`,
								conflict: {
									existingId: s.sesi_id,
									existingJamKe: s.jam_ke,
									existingGuru: guruExisting,
									existingMapel: s.mapel,
								},
								can_override: true,
							},
							{ status: 409 }
						);
					}
				}
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

		// Susun Catatan Audit Admin
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

		const labelKendala = alasan_kendala || 'Kendala Teknis (HP mati / tidak ada sinyal)';
		const extraKendala = catatan_kendala ? ` - ${catatan_kendala}` : '';
		const adminAudit = `Diinputkan oleh ${adminName} pada ${nowWib} [Bantuan Kendala: ${labelKendala}${extraKendala}]`;

		const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
			timeZone: 'Asia/Jakarta',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});

		const sesiId = `adm_${Math.random().toString(36).substring(2, 11)}`;

		const insertHeaderPayload = {
			sesi_id: sesiId,
			guru_id,
			tanggal,
			jam_ke: normJam,
			kelas,
			mapel,
			tahun_ajar: tahun_ajar || '',
			semester: semester ? parseInt(semester, 10) : 1,
			waktu_absen: nowTimeStr,
			catatan_admin: adminAudit,
			status_verifikasi: 'disetujui',
		};

		// INSERT MENGGUNAKAN supabaseAdmin (Bypass Geofence & RLS)
		let { data: insertedHeader, error: headerErr } = await supabaseAdmin
			.from('absensi_mapel')
			.insert(insertHeaderPayload)
			.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username)');

		// Fallback jika kolom baru (catatan_admin / status_verifikasi) belum ada di schema cache
		if (headerErr && (headerErr.code === 'PGRST204' || headerErr.code === '42703')) {
			const fallbackHeader = { ...insertHeaderPayload };
			delete fallbackHeader.catatan_admin;
			delete fallbackHeader.status_verifikasi;

			const retry = await supabaseAdmin
				.from('absensi_mapel')
				.insert(fallbackHeader)
				.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username)');
			headerErr = retry.error;
			insertedHeader = retry.data;
		}

		if (headerErr) throw headerErr;

		// 2. Simpan Rincian Kehadiran Siswa
		const studentRows = absensiList.map((item) => ({
			sesi_id: sesiId,
			siswa_id: item.siswa_id,
			status: normStatus(item.status || 'Hadir'),
			keterangan: item.keterangan || '',
		}));

		const { error: studentErr } = await supabaseAdmin.from('absensi_mapel_siswa').insert(studentRows);
		if (studentErr) {
			console.error('Gagal simpan absensi_mapel_siswa:', studentErr);
			// Jangan gagalkan seluruh proses jika header sudah masuk
		}

		// 3. Otomatis Buat & Sahkan Jurnal KBM Guru (Jika sync_jurnal = true)
		let createdJournal = null;
		if (sync_jurnal) {
			try {
				const scheduleTimes = getExpectedScheduleTimes(normJam, tanggal);
				const jamMulai = scheduleTimes ? scheduleTimes.start : '07:15';
				const jamSelesai = scheduleTimes ? scheduleTimes.end : '08:35';
				const durasiMenit = calculateDurationMinutes(jamMulai, jamSelesai) || 80;

				const journalId = `jrn_${Math.random().toString(36).substring(2, 11)}`;
				const journalPayload = {
					id: journalId,
					guru_id,
					tanggal,
					jam_ke: normJam,
					pertemuan_ke: '1',
					kelas,
					mapel,
					materi: `KBM ${mapel} [Presensi Terverifikasi Admin]`,
					kegiatan: `Kegiatan pembelajaran ${mapel} kelas ${kelas} telah dipresensi oleh Admin.`,
					metode: 'Ceramah',
					hambatan: `[${labelKendala}${extraKendala}]`,
					solusi: 'Presensi diinputkan langsung oleh Administrator sistem.',
					tuntas: true,
					tahun_ajar: tahun_ajar || '',
					semester: semester ? parseInt(semester, 10) : 1,
					jam_mulai: jamMulai,
					jam_selesai: jamSelesai,
					durasi_menit: durasiMenit,
					sesi_absensi_id: sesiId,
					status_kehadiran: 'Normal',
					status_verifikasi: 'disetujui',
					catatan_admin: `Jurnal otomatis diterbitkan dari Bantuan Presensi Admin pada ${nowWib}.`,
				};

				let { data: jData, error: jErr } = await supabaseAdmin
					.from('jurnal')
					.insert(journalPayload)
					.select();

				if (jErr && (jErr.code === 'PGRST204' || jErr.code === '42703')) {
					const fallbackJrn = { ...journalPayload };
					delete fallbackJrn.metode;
					delete fallbackJrn.jam_mulai;
					delete fallbackJrn.jam_selesai;
					delete fallbackJrn.durasi_menit;
					delete fallbackJrn.sesi_absensi_id;
					delete fallbackJrn.status_verifikasi;
					delete fallbackJrn.catatan_admin;
					const retryJrn = await supabaseAdmin.from('jurnal').insert(fallbackJrn).select();
					jData = retryJrn.data;
				}

				if (jData && jData.length > 0) {
					createdJournal = jData[0];
				}
			} catch (jrnExc) {
				console.warn('Gagal otomatisasi jurnal KBM terkait:', jrnExc);
			}
		}

		return NextResponse.json(
			{
				success: true,
				message: 'Presensi siswa berhasil diinput dan disahkan oleh Admin.',
				data: insertedHeader ? insertedHeader[0] : insertHeaderPayload,
				journal: createdJournal,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error POST /api/admin/absensi:', error);
		return NextResponse.json({ error: error.message || 'Gagal menyimpan presensi siswa.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// PUT: Edit Sesi Presensi & Perbarui Kehadiran Siswa oleh Admin
// ---------------------------------------------------------------------------
export async function PUT(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized, role, userId } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const {
			sesi_id,
			id,
			guru_id,
			kelas,
			mapel,
			tanggal,
			jam_ke,
			absensiList,
			sync_jurnal = true,
			override_conflict = false,
		} = body;

		const targetSesiId = sesi_id || id;
		if (!targetSesiId) {
			return NextResponse.json({ error: 'ID Sesi Presensi wajib disertakan.' }, { status: 400 });
		}

		// 1. Ambil data sesi eksisting
		const { data: existingData, error: fetchErr } = await supabaseAdmin
			.from('absensi_mapel')
			.select('*')
			.eq('sesi_id', targetSesiId)
			.maybeSingle();

		if (fetchErr || !existingData) {
			return NextResponse.json({ error: 'Sesi presensi tidak ditemukan.' }, { status: 404 });
		}

		const normJam = jam_ke !== undefined ? normalizeJamKe(jam_ke) : existingData.jam_ke;
		const targetKelas = kelas || existingData.kelas;
		const targetTanggal = tanggal || existingData.tanggal;
		const targetMapel = mapel || existingData.mapel;
		const targetGuruId = guru_id || existingData.guru_id;

		// 2. Cek Bentrok jika jam_ke, tanggal, atau kelas diubah
		if (!override_conflict && (normJam !== existingData.jam_ke || targetTanggal !== existingData.tanggal || targetKelas !== existingData.kelas)) {
			const { data: otherSessions } = await supabaseAdmin
				.from('absensi_mapel')
				.select('sesi_id, jam_ke, mapel, guru_id, users!absensi_mapel_guru_id_fkey(nama_lengkap)')
				.eq('kelas', targetKelas)
				.eq('tanggal', targetTanggal)
				.neq('sesi_id', targetSesiId);

			if (otherSessions && otherSessions.length > 0) {
				for (const s of otherSessions) {
					const { isOverlap } = checkJamOverlap(s.jam_ke, normJam);
					if (isOverlap) {
						const guruExisting = s.users?.nama_lengkap || 'Guru lain';
						return NextResponse.json({
							error: `Konflik: Jam ke-${normJam} di kelas ${targetKelas} bertabrakan dengan presensi ${s.mapel} oleh ${guruExisting} (Jam ${s.jam_ke}).`,
							conflict: {
								existingId: s.sesi_id,
								existingJamKe: s.jam_ke,
								existingGuru: guruExisting,
								existingMapel: s.mapel,
							},
							can_override: true,
						}, { status: 409 });
					}
				}
			}
		}

		const nowWib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
		const updates = {
			guru_id: targetGuruId,
			kelas: targetKelas,
			mapel: targetMapel,
			tanggal: targetTanggal,
			jam_ke: normJam,
			updated_at: new Date().toISOString(),
			catatan_admin: `Diperbarui oleh Admin pada ${nowWib}`,
		};

		// 3. Update Header Absensi Mapel
		let { data: updatedHeader, error: updateErr } = await supabaseAdmin
			.from('absensi_mapel')
			.update(updates)
			.eq('sesi_id', targetSesiId)
			.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username)');

		if (updateErr && (updateErr.code === 'PGRST204' || updateErr.code === '42703')) {
			const fallbackUpdates = { ...updates };
			delete fallbackUpdates.catatan_admin;
			const retry = await supabaseAdmin
				.from('absensi_mapel')
				.update(fallbackUpdates)
				.eq('sesi_id', targetSesiId)
				.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username)');
			updateErr = retry.error;
			updatedHeader = retry.data;
		}

		if (updateErr) throw updateErr;

		// 4. Perbarui Rincian Siswa jika disediakan
		if (absensiList && Array.isArray(absensiList) && absensiList.length > 0) {
			for (const item of absensiList) {
				if (!item.siswa_id) continue;
				const normSt = normStatus(item.status || 'Hadir');

				await supabaseAdmin
					.from('absensi_mapel_siswa')
					.upsert(
						{
							sesi_id: targetSesiId,
							siswa_id: item.siswa_id,
							status: normSt,
							keterangan: item.keterangan || '',
						},
						{ onConflict: 'sesi_id,siswa_id' }
					);
			}
		}

		// 5. Sinkronisasi ke Jurnal KBM Terkait
		if (sync_jurnal) {
			try {
				await supabaseAdmin
					.from('jurnal')
					.update({
						guru_id: targetGuruId,
						kelas: targetKelas,
						mapel: targetMapel,
						tanggal: targetTanggal,
						jam_ke: normJam,
					})
					.eq('sesi_absensi_id', targetSesiId);
			} catch (jrnSyncErr) {
				console.warn('Gagal sinkronisasi jurnal:', jrnSyncErr);
			}
		}

		return NextResponse.json({
			success: true,
			message: 'Sesi presensi siswa berhasil diperbarui oleh Admin.',
			data: updatedHeader ? updatedHeader[0] : updates,
		}, { status: 200 });
	} catch (error) {
		console.error('Error PUT /api/admin/absensi:', error);
		return NextResponse.json({ error: error.message || 'Gagal update presensi siswa.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// DELETE: Hapus Sesi Presensi oleh Admin (Termasuk Opsi Hapus Jurnal Terkait)
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const supabase = await createClient();
		const { isAuthorized } = await checkAdminAuth(req, supabase);

		if (!isAuthorized) {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const sesiId = searchParams.get('sesi_id') || searchParams.get('id');
		const deleteJurnal = searchParams.get('delete_jurnal') === 'true';

		if (!sesiId) {
			return NextResponse.json({ error: 'ID Sesi Presensi diperlukan.' }, { status: 400 });
		}

		// 1. Ambil data sesi sebelum dihapus untuk cek keterkaitan jurnal
		const { data: session } = await supabaseAdmin
			.from('absensi_mapel')
			.select('sesi_id, kelas, mapel, tanggal, jam_ke')
			.eq('sesi_id', sesiId)
			.maybeSingle();

		// 2. Hapus rincian siswa di absensi_mapel_siswa
		await supabaseAdmin.from('absensi_mapel_siswa').delete().eq('sesi_id', sesiId);

		// 3. Hapus header absensi_mapel
		const { error: delErr } = await supabaseAdmin.from('absensi_mapel').delete().eq('sesi_id', sesiId);
		if (delErr) throw delErr;

		// 4. Hapus / Putus tautan jurnal KBM jika diminta
		if (deleteJurnal && session) {
			try {
				await supabaseAdmin.from('jurnal').delete().eq('sesi_absensi_id', sesiId);
			} catch (jrnDelErr) {
				console.warn('Gagal hapus jurnal terkait:', jrnDelErr);
			}
		} else if (session) {
			// Putus link sesi_absensi_id di jurnal agar tidak foreign key error
			try {
				await supabaseAdmin
					.from('jurnal')
					.update({ sesi_absensi_id: null })
					.eq('sesi_absensi_id', sesiId);
			} catch (unlinkErr) {
				console.warn('Gagal unlink jurnal:', unlinkErr);
			}
		}

		return NextResponse.json({
			success: true,
			message: 'Sesi presensi siswa beserta seluruh rincian berhasil dihapus.',
		}, { status: 200 });
	} catch (error) {
		console.error('Error DELETE /api/admin/absensi:', error);
		return NextResponse.json({ error: error.message || 'Gagal menghapus presensi siswa.' }, { status: 500 });
	}
}
