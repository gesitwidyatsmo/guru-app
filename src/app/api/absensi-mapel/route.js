import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { calculateAttendanceSummary, findConflictingSession, normalizeJamKe } from '@/lib/absensiUtils';
import { verifyGeofence } from '@/lib/geofenceServer';

const generateId = () => Math.random().toString(36).slice(2, 11);
const normDate = (v) => String(v ?? '').slice(0, 10);

/** Ambil tahun_ajar & semester aktif dari DB server-side. */
async function getTAAktif(supabase) {
	const { data, error } = await supabase
		.from('tahun_ajar')
		.select('nama, semester')
		.eq('is_aktif', true)
		.single();
	if (error || !data) throw new Error('Tahun ajar aktif tidak ditemukan. Hubungi Admin untuk mengaktifkan tahun ajar.');
	return { nama: data.nama, semester: data.semester };
}

// GET:
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const rawJamKe = searchParams.get('jam_ke');
		const jam_ke = rawJamKe ? normalizeJamKe(rawJamKe) : null;
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');

		const allMapel = searchParams.get('all_mapel') === 'true' || searchParams.get('cek_konflik') === 'true';
		if (allMapel && kelas && tanggal) {
			const supabase = await createClient();
			const { data: allSessions, error: allErr } = await supabase
				.from('absensi_mapel')
				.select('sesi_id, guru_id, tanggal, jam_ke, kelas, mapel, created_at, users(nama_lengkap)')
				.eq('kelas', kelas)
				.eq('tanggal', tanggal);
			if (allErr) throw allErr;
			const mapped = (allSessions || []).map((s) => ({
				...s,
				id: s.sesi_id,
				nama_guru: s.users?.nama_lengkap || 'Guru',
			}));
			return NextResponse.json(mapped);
		}

		if (!kelas || !mapel) {
			const crossCheck = searchParams.get('cross_check') === 'true';
			const startDate = searchParams.get('startDate') || searchParams.get('start_date');
			const endDate = searchParams.get('endDate') || searchParams.get('end_date');
			const guruId = searchParams.get('guru_id');

			// Izinkan query jika mode cross-check atau date range oleh Bendahara/Kepsek/Admin
			const isCrossAudit =
				crossCheck ||
				Boolean(startDate || endDate) ||
				['Bendahara', 'Kepala Sekolah', 'Admin', 'Kurikulum', 'Kesiswaan'].includes(role);

			if (isCrossAudit) {
				const supabase = await createClient();
				let query = supabase
					.from('absensi_mapel')
					.select('sesi_id, guru_id, tanggal, jam_ke, kelas, mapel, created_at, absensi_mapel_siswa(id, status, keterangan)')
					.order('tanggal', { ascending: false });

				if (kelas) query = query.eq('kelas', kelas);
				if (mapel) query = query.eq('mapel', mapel);
				if (tanggal) query = query.eq('tanggal', tanggal);
				if (startDate) query = query.gte('tanggal', startDate);
				if (endDate) query = query.lte('tanggal', endDate);
				if (guruId) query = query.eq('guru_id', guruId);
				if (role === 'Guru' && userId) query = query.eq('guru_id', userId);

				const { data: sessions, error } = await query;
				if (error) throw error;

				const pertemuan = (sessions || []).map((r) => {
					const details = r.absensi_mapel_siswa || [];
					return {
						id: r.sesi_id,
						sesi_id: r.sesi_id,
						guru_id: r.guru_id || '',
						tanggal: normDate(r.tanggal),
						jam_ke: r.jam_ke,
						created_at: r.created_at,
						kelas: r.kelas,
						mapel: r.mapel,
						data_absensi: details,
						summary: calculateAttendanceSummary(details),
					};
				});

				return NextResponse.json(pertemuan);
			}

			return NextResponse.json({ error: 'Parameter kelas & mapel wajib' }, { status: 400 });
		}

		const supabase = await createClient();
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');
		let query = supabase.from('absensi_mapel').select('sesi_id, guru_id, tanggal, jam_ke, kelas, mapel, created_at').eq('kelas', kelas).eq('mapel', mapel);

		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester));

		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		if (bulan && tahun) {
			const b = parseInt(bulan, 10);
			const y = parseInt(tahun, 10);
			const startDate = `${y}-${String(b).padStart(2, '0')}-01`;
			const lastDay = new Date(y, b, 0).getDate();
			const endDate = `${y}-${String(b).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
			query = query.gte('tanggal', startDate).lte('tanggal', endDate);
		}

		if (tanggal && jam_ke) {
			query = query.eq('tanggal', tanggal).eq('jam_ke', jam_ke);
			const { data: sesiData, error: sesiError } = await query.maybeSingle();

			if (sesiError || !sesiData) return NextResponse.json([]);

			const { data: detailData, error: detailError } = await supabase
				.from('absensi_mapel_siswa')
				.select('siswa_id, status, keterangan')
				.eq('sesi_id', sesiData.sesi_id);

			if (detailError) throw detailError;
			
			// Map id_row to support frontend's old format
			const mappedData = (detailData || []).map(d => ({ ...d, id_row: sesiData.sesi_id }));
			return NextResponse.json(mappedData);
		}

		// Filter tanggal jika ada (List mode per tanggal spesifik)
		if (tanggal && !jam_ke) {
			query = query.eq('tanggal', tanggal);
		}

		// List mode
		const { data: sessions, error } = await query;
		if (error) throw error;

		let allDetails = [];
		if (sessions && sessions.length > 0) {
			const sesiIds = sessions.map(s => s.sesi_id);
			const { data: detailData, error: detailError } = await supabase
				.from('absensi_mapel_siswa')
				.select('sesi_id, siswa_id, status, keterangan')
				.in('sesi_id', sesiIds);
			
			if (!detailError && detailData) {
				allDetails = detailData;
			}
		}

		const pertemuan = (sessions || []).map((r) => {
			const detailsForSession = allDetails.filter(d => d.sesi_id === r.sesi_id);
			return {
				id: r.sesi_id,
				guru_id: r.guru_id || '',
				tanggal: normDate(r.tanggal),
				jam_ke: r.jam_ke,
				created_at: r.created_at,
				kelas: r.kelas,
				mapel: r.mapel,
				data_absensi: detailsForSession,
				summary: calculateAttendanceSummary(detailsForSession),
			};
		});

		pertemuan.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
		return NextResponse.json(pertemuan);
	} catch (error) {
		console.error('GET /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// POST upsert
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}

		const body = await req.json();
		const oldTanggal = body.oldTanggal || body.tanggal;
		const newTanggal = body.newTanggal || body.tanggal;
		const oldJamKe = normalizeJamKe(body.oldJam_ke || body.jam_ke);
		const newJamKe = normalizeJamKe(body.newJam_ke || body.jam_ke);
		const { kelas, mapel } = body;
		const data_absensi = body.absensiList || body.data;

		if (!oldTanggal || !oldJamKe || !kelas || !mapel) {
			return NextResponse.json({ error: 'parameter wajib tidak lengkap' }, { status: 400 });
		}

		if (!data_absensi || !Array.isArray(data_absensi) || data_absensi.length === 0) {
			return NextResponse.json({ error: 'Data absensi siswa tidak boleh kosong' }, { status: 400 });
		}

		const supabase = await createClient();

		// Verifikasi Geofence jika diaktifkan oleh Admin
		const geoCheck = await verifyGeofence({
			supabase,
			userLat: body.user_lat,
			userLng: body.user_lng,
			moduleName: 'absensi',
			role,
		});

		if (!geoCheck.allowed) {
			return NextResponse.json({ error: geoCheck.error }, { status: geoCheck.status || 403 });
		}

		// 1. Cek apakah sesi sudah ada: Prioritaskan ID/sesi_id dari body, lalu fallback ke tanggal & jam lama
		const targetId = body.id || body.sesi_id;
		let existingSesi = null;
		let existingSesiList = [];

		if (targetId) {
			let idQuery = supabase.from('absensi_mapel')
				.select('sesi_id, jam_ke, tanggal, created_at')
				.eq('sesi_id', targetId);
			if (role === 'Guru' && userId) {
				idQuery = idQuery.eq('guru_id', userId);
			}
			const { data: byIdData } = await idQuery.maybeSingle();
			if (byIdData) {
				existingSesi = byIdData;
				existingSesiList = [byIdData];
			}
		}

		if (!existingSesi) {
			let query = supabase.from('absensi_mapel')
				.select('sesi_id, jam_ke, tanggal, created_at')
				.eq('kelas', kelas)
				.eq('mapel', mapel)
				.eq('tanggal', oldTanggal)
				.eq('jam_ke', oldJamKe);

			if (role === 'Guru' && userId) {
				query = query.eq('guru_id', userId);
			}

			const { data: foundList } = await query.order('created_at', { ascending: false });
			if (foundList && foundList.length > 0) {
				existingSesiList = foundList;
				existingSesi = foundList[0];
			}
		}

		let sesiId = existingSesi ? existingSesi.sesi_id : (targetId || `SESI-M-${generateId()}`);

		// 2. Cek tumpang tindih (overlap) jam pelajaran dengan seluruh sesi lain di kelas ini pada tanggal yang sama
		const { data: allSessionsToday } = await supabase
			.from('absensi_mapel')
			.select('sesi_id, jam_ke, mapel, guru_id, users(nama_lengkap)')
			.eq('kelas', kelas)
			.eq('tanggal', newTanggal);

		const conflict = findConflictingSession(allSessionsToday || [], newJamKe, existingSesi?.sesi_id);
		if (conflict) {
			const conflictTeacher = conflict.session.users?.nama_lengkap || 'Guru lain';
			const conflictMapel = conflict.session.mapel || 'Mapel lain';
			const isSameMapel = String(conflict.session.mapel || '').trim().toLowerCase() === String(mapel || '').trim().toLowerCase();

			if (!isSameMapel) {
				return NextResponse.json(
					{
						error: `Konflik Jam: Jam ke-${newJamKe} bertabrakan dengan mapel ${conflictMapel} (${conflictTeacher}) pada Jam ${conflict.session.jam_ke} (Jam ke-${conflict.conflicts.length > 0 ? conflict.conflicts.join(', ') : conflict.session.jam_ke}). Satu rombel kelas tidak boleh memiliki kegiatan KBM ganda di jam pelajaran yang sama.`,
						conflict: {
							existingJamKe: conflict.session.jam_ke,
							conflicts: conflict.conflicts,
							existingSesiId: conflict.session.sesi_id,
							mapel: conflictMapel,
							guru: conflictTeacher,
							isOtherMapel: true,
						},
					},
					{ status: 409 }
				);
			} else if (conflict.overlapType === 'overlap') {
				return NextResponse.json(
					{
						error: `Konflik Jam: Jam ke-${newJamKe} bertabrakan dengan sesi Jam ${conflict.session.jam_ke} yang sudah ada (Jam ke-${conflict.conflicts.join(', ')}). Tidak diperbolehkan membuat sesi tumpang tindih.`,
						conflict: {
							existingJamKe: conflict.session.jam_ke,
							conflicts: conflict.conflicts,
							existingSesiId: conflict.session.sesi_id,
							mapel: conflictMapel,
							guru: conflictTeacher,
							isOtherMapel: false,
						},
					},
					{ status: 409 }
				);
			}
		}

		if (existingSesi) {
			const updates = {};
			if (oldTanggal !== newTanggal || existingSesi.tanggal !== newTanggal) updates.tanggal = newTanggal;
			if (oldJamKe !== newJamKe || existingSesi.jam_ke !== newJamKe) updates.jam_ke = newJamKe;
			if (body.client_time) updates.waktu_absen = body.client_time;
			updates.updated_at = new Date().toISOString();
			
			let { error: updErr } = await supabase.from('absensi_mapel').update(updates).eq('sesi_id', sesiId);
			if (updErr && (updErr.code === 'PGRST204' || updErr.code === '42703' || String(updErr.message || '').includes('column'))) {
				const safeUpdates = { ...updates };
				delete safeUpdates.updated_at;
				delete safeUpdates.waktu_absen;
				if (Object.keys(safeUpdates).length > 0) {
					const retry = await supabase.from('absensi_mapel').update(safeUpdates).eq('sesi_id', sesiId);
					updErr = retry.error;
				} else {
					updErr = null;
				}
			}
			if (updErr) throw updErr;

			const { error: delErr } = await supabase.from('absensi_mapel_siswa').delete().eq('sesi_id', sesiId);
			if (delErr) throw delErr;

			// Bersihkan sisa sesi duplikat jika pernah ada sebelumnya
			if (existingSesiList.length > 1) {
				const duplicateIds = existingSesiList.slice(1).map(s => s.sesi_id);
				await supabase.from('absensi_mapel_siswa').delete().in('sesi_id', duplicateIds);
				await supabase.from('absensi_mapel').delete().in('sesi_id', duplicateIds);
			}
		} else {
			// Gunakan tahun ajar dari body; jika tidak ada, ambil yang aktif dari DB
			const taAktif = (!body.tahun_ajar || !body.semester) ? await getTAAktif(supabase) : null;
			const insertData = {
				sesi_id: sesiId,
				guru_id: userId || null,
				tanggal: newTanggal,
				jam_ke: newJamKe,
				kelas: kelas,
				mapel: mapel,
				tahun_ajar: body.tahun_ajar || taAktif.nama,
				semester: body.semester ? parseInt(body.semester) : taAktif.semester,
			};
			if (body.client_time) insertData.waktu_absen = body.client_time;

			let { error: insErr } = await supabase.from('absensi_mapel').insert(insertData);
			if (insErr && (insErr.code === 'PGRST204' || insErr.code === '42703' || String(insErr.message || '').includes('column'))) {
				const safeInsert = { ...insertData };
				delete safeInsert.waktu_absen;
				delete safeInsert.updated_at;
				const retry = await supabase.from('absensi_mapel').insert(safeInsert);
				insErr = retry.error;
			}
			if (insErr) throw insErr;
		}

		const rowsToInsert = data_absensi.map(item => ({
			sesi_id: sesiId,
			siswa_id: item.siswa_id,
			status: item.status,
			keterangan: item.keterangan || ''
		}));
		const { error: insDetailsErr } = await supabase.from('absensi_mapel_siswa').insert(rowsToInsert);
		if (insDetailsErr) throw insDetailsErr;

		return NextResponse.json({ success: true, id: sesiId, mode: existingSesi ? 'update' : 'insert' });
	} catch (error) {
		console.error('POST /absensi-mapel Error:', error);
		return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
	}
}

// DELETE: Hapus sesi
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah') {
			return NextResponse.json({ error: 'Akses Ditolak: Kepala Sekolah hanya memiliki hak akses pantau (read-only).' }, { status: 403 });
		}
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const rawJamKe = searchParams.get('jam_ke');
		const jam_ke = rawJamKe ? normalizeJamKe(rawJamKe) : null;

		if (!kelas || !mapel || !tanggal || !jam_ke) {
			return NextResponse.json({ error: 'parameter kurang' }, { status: 400 });
		}

		const supabase = await createClient();
		let query = supabase.from('absensi_mapel')
			.delete()
			.eq('kelas', kelas)
			.eq('mapel', mapel)
			.eq('tanggal', tanggal)
			.eq('jam_ke', jam_ke);

		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		const { data: deleted, error } = await query.select();

		if (error) throw error;
		if (!deleted || deleted.length === 0) {
			return NextResponse.json({ error: 'Data absensi tidak ditemukan / Akses Ditolak' }, { status: 403 });
		}

		return NextResponse.json({ success: true, deleted: deleted.length });
	} catch (error) {
		console.error('DELETE /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
