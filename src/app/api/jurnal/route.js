import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { haversine } from '@/lib/haversine';
import { getTimeWIB, calculateDurationMinutes, determineKBMStatus } from '@/lib/kbmRealtimeUtils';
import { findConflictingSession } from '@/lib/absensiUtils';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

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

// GET JURNAL
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');
		const tanggalParam = searchParams.get('tanggal');
		const checkConflict = searchParams.get('check_conflict') === 'true';

		const supabase = await createClient();

		// Mode Cek Konflik Jam Pelajaran (Tingkat Kelas - Opsi 1)
		if (checkConflict && kelas && tanggalParam) {
			const { data: conflictJournals, error: conflictErr } = await supabase
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, users!jurnal_guru_id_fkey(nama_lengkap, username)')
				.eq('kelas', kelas)
				.eq('tanggal', tanggalParam);

			if (conflictErr) throw conflictErr;
			return NextResponse.json(conflictJournals || [], { status: 200 });
		}

		let query = supabase
			.from('jurnal')
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
			.order('tanggal', { ascending: false });

		// 1. Filter Isolasi Hak Akses (Guru hanya melihat miliknya)
		if (role === 'Guru' && userId) {
			query = query.eq('guru_id', userId);
		}

		// 2. Filter dari Parameter URL
		if (kelas) query = query.eq('kelas', kelas);
		if (mapel) query = query.eq('mapel', mapel);
		// 3. Filter Periode Akademik
		if (tahunAjar) query = query.eq('tahun_ajar', tahunAjar);
		if (semester) query = query.eq('semester', parseInt(semester));

		const { data, error } = await query;
		if (error) throw error;

		return NextResponse.json(data || [], { status: 200 });
	} catch (error) {
		console.error('❌ Error GET jurnal:', error);
		return NextResponse.json({ error: 'Gagal ambil data' }, { status: 500 });
	}
}

// POST JURNAL BARU
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah' || role === 'Bendahara') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Kepala Sekolah dan Bendahara hanya memiliki hak akses pantau (read-only).' },
				{ status: 403 }
			);
		}

		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const {
			tanggal,
			jam_ke,
			pertemuan_ke,
			kelas,
			mapel,
			metode,
			materi,
			kegiatan,
			hambatan,
			solusi,
			tuntas,
			tahun_ajar,
			semester,
			user_lat,
			user_lng,
		} = body;

		const supabase = await createClient();

		// Verifikasi Geofence jika diaktifkan oleh Admin
		try {
			const { data: geofenceSetting } = await supabase
				.from('app_settings')
				.select('value')
				.eq('key', 'geofence')
				.maybeSingle();

			const geofence = geofenceSetting?.value;
			if (geofence?.enabled) {
				if (user_lat === undefined || user_lng === undefined || user_lat === null || user_lng === null) {
					return NextResponse.json(
						{
							error: `Akses Lokasi Wajib: Sistem pembatasan area aktif untuk ${
								geofence.nama_lokasi || 'Area Sekolah'
							}. Harap aktifkan GPS dan izinkan akses lokasi di browser Anda.`,
						},
						{ status: 403 }
					);
				}

				const distance = haversine(user_lat, user_lng, geofence.lat, geofence.lng);
				if (distance > geofence.radius) {
					return NextResponse.json(
						{
							error: `Di Luar Radius: Anda terdeteksi berada ${Math.round(
								distance
							)} meter dari ${geofence.nama_lokasi || 'Sekolah'} (radius izin: ${
								geofence.radius
							}m). Jurnal hanya dapat diisi dari lingkungan sekolah.`,
						},
						{ status: 403 }
					);
				}
			}
		} catch (geoErr) {
			console.warn('Geofence verification skipped or table missing:', geoErr.message);
		}

		// Validasi Bentrok Jam Mengajar (Tingkat Kelas - Opsi 1)
		if (tanggal && kelas && jam_ke) {
			const { data: existingJournals } = await supabase
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('kelas', kelas)
				.eq('tanggal', tanggal);

			const conflict = findConflictingSession(existingJournals || [], jam_ke);
			if (conflict) {
				const guruExisting = conflict.session.users?.nama_lengkap || 'Guru lain';
				const mapelExisting = conflict.session.mapel || 'Mapel lain';
				const conflictDetail = conflict.conflicts?.length > 0 ? ` (Jam ke-${conflict.conflicts.join(', ')})` : '';
				return NextResponse.json(
					{
						error: `Konflik Jam Mengajar: Jam ke-${jam_ke} bertabrakan dengan jurnal ${mapelExisting} oleh ${guruExisting} (Jam ${conflict.session.jam_ke})${conflictDetail} pada kelas ${kelas} tanggal ${tanggal}. Satu kelas tidak boleh memiliki kegiatan KBM ganda di jam yang sama.`,
						conflict: {
							existingJamKe: conflict.session.jam_ke,
							conflicts: conflict.conflicts,
							existingMapel: mapelExisting,
							existingGuru: guruExisting,
							existingId: conflict.session.id,
						},
					},
					{ status: 409 }
				);
			}
		}

		const id = generateId();

		// Gunakan tahun ajar dari body; jika tidak ada, ambil yang aktif dari DB
		const taAktif = (!tahun_ajar || !semester) ? await getTAAktif(supabase) : null;

		// Otomatis sinkronisasi kehadiran KBM real-time dari absensi siswa
		let finalJamMulai = body.jam_mulai || null;
		let finalSesiAbsensiId = body.sesi_absensi_id || null;
		const nowWib = getTimeWIB(new Date());
		let finalJamSelesai = body.jam_selesai || nowWib;

		if (!finalJamMulai && tanggal && kelas && mapel) {
			try {
				let absensiQuery = supabase
					.from('absensi_mapel')
					.select('sesi_id, created_at, jam_ke')
					.eq('kelas', kelas)
					.eq('mapel', mapel)
					.eq('tanggal', tanggal);
				if (userId) absensiQuery = absensiQuery.eq('guru_id', userId);
				const { data: matchedSessions } = await absensiQuery.order('created_at', { ascending: false });

				if (matchedSessions && matchedSessions.length > 0) {
					const exactMatch = matchedSessions.find((s) => s.jam_ke === jam_ke);
					const chosen = exactMatch || matchedSessions[0];
					if (chosen.created_at) {
						finalJamMulai = getTimeWIB(chosen.created_at);
						finalSesiAbsensiId = chosen.sesi_id;
					}
				}
			} catch (errAbs) {
				console.warn('Gagal lookup absensi_mapel:', errAbs);
			}
		}

		const finalDurasi = calculateDurationMinutes(finalJamMulai, finalJamSelesai);
		const computedStatus = determineKBMStatus({
			jamMulai: finalJamMulai,
			jamSelesai: finalJamSelesai,
			durasiMenit: finalDurasi,
			tanggal,
			jamKe: jam_ke,
		});
		const finalStatus = (body.status_kehadiran && body.status_kehadiran !== 'Normal') ? body.status_kehadiran : computedStatus;

		const insertPayload = {
			id,
			guru_id: userId || null,
			tanggal,
			jam_ke: jam_ke || '',
			pertemuan_ke: pertemuan_ke || '',
			kelas,
			mapel,
			materi,
			kegiatan: kegiatan || '',
			hambatan: hambatan || '',
			solusi: solusi || '',
			tuntas: !!tuntas,
			tahun_ajar: tahun_ajar || taAktif.nama,
			semester: semester ? parseInt(semester) : taAktif.semester,
		};
		if (metode) insertPayload.metode = metode;
		if (finalJamMulai) insertPayload.jam_mulai = finalJamMulai;
		if (finalJamSelesai) insertPayload.jam_selesai = finalJamSelesai;
		if (finalDurasi !== undefined) insertPayload.durasi_menit = finalDurasi;
		if (finalSesiAbsensiId) insertPayload.sesi_absensi_id = finalSesiAbsensiId;
		if (finalStatus) insertPayload.status_kehadiran = finalStatus;

		let { error } = await supabase.from('jurnal').insert(insertPayload);

		// Fallback jika kolom baru belum ada di tabel Supabase
		if (error && error.code === 'PGRST204') {
			const fallbackPayload = { ...insertPayload };
			delete fallbackPayload.metode;
			delete fallbackPayload.jam_mulai;
			delete fallbackPayload.jam_selesai;
			delete fallbackPayload.durasi_menit;
			delete fallbackPayload.sesi_absensi_id;
			delete fallbackPayload.status_kehadiran;
			if (insertPayload.metode && !fallbackPayload.kegiatan.includes('[Metode:')) {
				fallbackPayload.kegiatan = `[Metode: ${insertPayload.metode}] ${fallbackPayload.kegiatan}`.trim();
			}
			const retry = await supabase.from('jurnal').insert(fallbackPayload);
			error = retry.error;
		}

		if (error) throw error;

		return NextResponse.json({ success: true, id }, { status: 201 });
	} catch (error) {
		console.error('❌ Error POST jurnal:', error);
		return NextResponse.json({ error: 'Gagal simpan' }, { status: 500 });
	}
}

// PUT UPDATE JURNAL
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah' || role === 'Bendahara') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Kepala Sekolah dan Bendahara hanya memiliki hak akses pantau (read-only).' },
				{ status: 403 }
			);
		}

		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const { id, pertemuan_ke, metode, ...others } = body;

		const supabase = await createClient();

		// Ambil data jurnal eksisting untuk verifikasi kepemilikan dan data tanggal/kelas
		const { data: existingData } = await supabase
			.from('jurnal')
			.select('guru_id, kelas, tanggal, jam_ke')
			.eq('id', id)
			.maybeSingle();

		// Verifikasi kepemilikan jika Guru
		if (role === 'Guru' && userId) {
			if (existingData && existingData.guru_id && existingData.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Ini bukan Jurnal ciptaan Anda!' }, { status: 403 });
			}
		}

		// Validasi Bentrok Jam Mengajar (Tingkat Kelas - Opsi 1) saat edit
		const targetTanggal = others.tanggal || existingData?.tanggal;
		const targetKelas = others.kelas || existingData?.kelas;
		const targetJamKe = others.jam_ke !== undefined ? others.jam_ke : existingData?.jam_ke;

		if (targetTanggal && targetKelas && targetJamKe) {
			const { data: existingJournals } = await supabase
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('kelas', targetKelas)
				.eq('tanggal', targetTanggal);

			const conflict = findConflictingSession(existingJournals || [], targetJamKe, id);
			if (conflict) {
				const guruExisting = conflict.session.users?.nama_lengkap || 'Guru lain';
				const mapelExisting = conflict.session.mapel || 'Mapel lain';
				const conflictDetail = conflict.conflicts?.length > 0 ? ` (Jam ke-${conflict.conflicts.join(', ')})` : '';
				return NextResponse.json(
					{
						error: `Konflik Jam Mengajar: Jam ke-${targetJamKe} bertabrakan dengan jurnal ${mapelExisting} oleh ${guruExisting} (Jam ${conflict.session.jam_ke})${conflictDetail} pada kelas ${targetKelas} tanggal ${targetTanggal}. Satu kelas tidak boleh memiliki kegiatan KBM ganda di jam yang sama.`,
						conflict: {
							existingJamKe: conflict.session.jam_ke,
							conflicts: conflict.conflicts,
							existingMapel: mapelExisting,
							existingGuru: guruExisting,
							existingId: conflict.session.id,
						},
					},
					{ status: 409 }
				);
			}
		}

		const updates = { ...others };
		if (pertemuan_ke !== undefined) updates.pertemuan_ke = pertemuan_ke;
		if (updates.tuntas !== undefined) updates.tuntas = !!updates.tuntas;
		if (metode !== undefined) updates.metode = metode;

		if (updates.jam_mulai !== undefined) {
			updates.jam_mulai = updates.jam_mulai && String(updates.jam_mulai).trim() !== '' ? String(updates.jam_mulai).trim().slice(0, 8) : null;
		}
		if (updates.jam_selesai !== undefined) {
			updates.jam_selesai = updates.jam_selesai && String(updates.jam_selesai).trim() !== '' ? String(updates.jam_selesai).trim().slice(0, 8) : null;
		}
		if (updates.sesi_absensi_id !== undefined) {
			updates.sesi_absensi_id = updates.sesi_absensi_id && String(updates.sesi_absensi_id).trim() !== '' ? String(updates.sesi_absensi_id).trim() : null;
		}
		if (updates.durasi_menit !== undefined) {
			updates.durasi_menit = !isNaN(Number(updates.durasi_menit)) ? Number(updates.durasi_menit) : 0;
		}
		if (updates.jam_mulai && updates.jam_selesai) {
			updates.status_kehadiran = determineKBMStatus({
				jamMulai: updates.jam_mulai,
				jamSelesai: updates.jam_selesai,
				durasiMenit: updates.durasi_menit,
				tanggal: updates.tanggal,
				jamKe: updates.jam_ke,
			});
		} else if (updates.status_kehadiran !== undefined) {
			updates.status_kehadiran = updates.status_kehadiran && String(updates.status_kehadiran).trim() !== '' ? String(updates.status_kehadiran).trim() : 'Normal';
		}

		let { error } = await supabase.from('jurnal').update(updates).eq('id', id);

		// Fallback jika kolom baru belum ada di tabel Supabase
		if (error) {
			const isMissingCol =
				error.code === 'PGRST204' ||
				error.code === '42703' ||
				String(error.message || '').toLowerCase().includes('column') ||
				String(error.message || '').toLowerCase().includes('schema cache');

			if (isMissingCol) {
				const fallbackUpdates = { ...updates };
				delete fallbackUpdates.metode;
				delete fallbackUpdates.jam_mulai;
				delete fallbackUpdates.jam_selesai;
				delete fallbackUpdates.durasi_menit;
				delete fallbackUpdates.sesi_absensi_id;
				delete fallbackUpdates.status_kehadiran;
				const retry = await supabase.from('jurnal').update(fallbackUpdates).eq('id', id);
				error = retry.error;
			}
		}

		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('PUT Jurnal Error:', error);
		return NextResponse.json({ error: 'Gagal update' }, { status: 500 });
	}
}

// DELETE JURNAL
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role === 'Kepala Sekolah' || role === 'Bendahara') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Kepala Sekolah dan Bendahara hanya memiliki hak akses pantau (read-only).' },
				{ status: 403 }
			);
		}

		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();

		// Verifikasi kepemilikan jika Guru
		if (role === 'Guru') {
			const { data: existingData } = await supabase.from('jurnal').select('guru_id').eq('id', id).single();
			if (!existingData) {
				return NextResponse.json({ error: 'Data Jurnal spesifik tidak ditemukan' }, { status: 404 });
			}
			if (existingData.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Anda mencoba menghapus Jurnal kolega Anda.' }, { status: 403 });
			}
		}

		const { error } = await supabase.from('jurnal').delete().eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('DELETE Jurnal Error:', error);
		return NextResponse.json({ error: 'Gagal hapus' }, { status: 500 });
	}
}
