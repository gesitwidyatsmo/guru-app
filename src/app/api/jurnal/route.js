import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { haversine } from '@/lib/haversine';

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

		const supabase = await createClient();
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
		const id = generateId();

		// Gunakan tahun ajar dari body; jika tidak ada, ambil yang aktif dari DB
		const taAktif = (!tahun_ajar || !semester) ? await getTAAktif(supabase) : null;

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

		let { error } = await supabase.from('jurnal').insert(insertPayload);

		// Fallback jika kolom metode belum ada di tabel Supabase
		if (error && error.code === 'PGRST204' && insertPayload.metode) {
			const fallbackPayload = { ...insertPayload };
			delete fallbackPayload.metode;
			if (!fallbackPayload.kegiatan.includes('[Metode:')) {
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

		// Verifikasi kepemilikan jika Guru
		if (role === 'Guru') {
			const { data: existingData } = await supabase.from('jurnal').select('guru_id').eq('id', id).single();
			if (!existingData) {
				return NextResponse.json({ error: 'Data Jurnal spesifik tidak ditemukan' }, { status: 404 });
			}
			if (existingData.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Ini bukan Jurnal ciptaan Anda!' }, { status: 403 });
			}
		}

		const updates = { ...others };
		if (pertemuan_ke !== undefined) updates.pertemuan_ke = pertemuan_ke;
		if (updates.tuntas !== undefined) updates.tuntas = !!updates.tuntas;
		if (metode !== undefined) updates.metode = metode;

		let { error } = await supabase.from('jurnal').update(updates).eq('id', id);

		// Fallback jika kolom metode belum ada di tabel Supabase
		if (error && error.code === 'PGRST204' && updates.metode) {
			const fallbackUpdates = { ...updates };
			delete fallbackUpdates.metode;
			const retry = await supabase.from('jurnal').update(fallbackUpdates).eq('id', id);
			error = retry.error;
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
