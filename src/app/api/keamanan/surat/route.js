import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { getTodayDateString } from '@/lib/dateUtils';

// Helper nomor surat: SRT-KM/YYYYMMDD/XXXX
function generateNomorSurat(tanggal) {
	const cleanDate = (tanggal || getTodayDateString()).replace(/[^0-9]/g, '');
	const randomSuffix = Math.floor(1000 + Math.random() * 9000);
	return `SRT-KM/${cleanDate}/${randomSuffix}`;
}

// GET: Ambil daftar surat izin keamanan
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const tanggal = searchParams.get('tanggal');
		const kelas = searchParams.get('kelas');
		const siswaId = searchParams.get('siswa_id');
		const statusSurat = searchParams.get('status_surat'); // 'aktif', 'selesai', 'dibatalkan', or null (all)

		let query = supabaseAdmin
			.from('keamanan_surat_izin')
			.select('*')
			.order('created_at', { ascending: false });

		if (tanggal) {
			query = query.eq('tanggal', tanggal);
		}
		if (kelas) {
			query = query.eq('kelas', kelas);
		}
		if (siswaId) {
			query = query.eq('siswa_id', siswaId);
		}
		if (statusSurat && statusSurat !== 'all') {
			query = query.eq('status_surat', statusSurat);
		}

		const { data, error } = await query;

		if (error) {
			// Tabel belum ada di Supabase
			if (error.code === 'PGRST205' || String(error.message).includes('keamanan_surat_izin')) {
				return NextResponse.json({
					data: [],
					tableReady: false,
					message: 'Tabel keamanan_surat_izin belum dibuat. Jalankan migrations/add_role_keamanan_and_surat_izin.sql di SQL Editor Supabase.',
				});
			}
			throw error;
		}

		return NextResponse.json({
			data: data || [],
			tableReady: true,
		});
	} catch (err) {
		console.error('GET /api/keamanan/surat error:', err);
		return NextResponse.json({ error: err.message || 'Gagal mengambil data surat' }, { status: 500 });
	}
}

// POST: Terbitkan surat izin baru
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const userName = req.headers.get('x-user-name') ? decodeURIComponent(req.headers.get('x-user-name')) : 'Petugas Keamanan';

		if (role !== 'Admin' && role !== 'Keamanan') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Petugas Keamanan atau Admin yang dapat menerbitkan surat izin.' },
				{ status: 403 }
			);
		}

		const body = await req.json();
		const {
			siswa_id,
			nama_siswa,
			nis,
			kelas,
			tanggal,
			tipe_surat,
			status_absensi,
			jam_ke_mulai,
			jam_ke_selesai,
			berlaku_seharian,
			alasan,
			penjemput,
			waktu_surat,
			catatan,
		} = body;

		if (!siswa_id || !nama_siswa || !kelas || !tipe_surat || !alasan) {
			return NextResponse.json(
				{ error: 'Mohon lengkapi data wajib: Siswa, Kelas, Tipe Surat, dan Alasan.' },
				{ status: 400 }
			);
		}

		const tgl = tanggal || getTodayDateString();
		const nomorSurat = generateNomorSurat(tgl);

		// Dapatkan waktu jam WIB saat ini (HH:mm)
		const nowWib = new Date().toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		}).replace('.', ':');

		const rowToInsert = {
			nomor_surat: nomorSurat,
			siswa_id,
			nama_siswa,
			nis: nis || null,
			kelas,
			tanggal: tgl,
			tipe_surat, // 'terlambat' | 'izin_keluar' | 'pulang_cepat' | 'tidak_masuk'
			status_absensi: status_absensi || (tipe_surat === 'pulang_cepat' && String(alasan).toLowerCase().includes('sakit') ? 'Sakit' : 'Izin'),
			jam_ke_mulai: berlaku_seharian ? null : (jam_ke_mulai || null),
			jam_ke_selesai: berlaku_seharian ? null : (jam_ke_selesai || jam_ke_mulai || null),
			berlaku_seharian: Boolean(berlaku_seharian),
			alasan,
			penjemput: penjemput || null,
			waktu_surat: waktu_surat || nowWib,
			status_surat: 'aktif',
			petugas_id: userId || null,
			petugas_nama: userName || 'Petugas Keamanan',
			catatan: catatan || null,
		};

		const { data, error } = await supabaseAdmin
			.from('keamanan_surat_izin')
			.insert(rowToInsert)
			.select()
			.single();

		if (error) {
			if (error.code === 'PGRST205' || String(error.message).includes('keamanan_surat_izin')) {
				return NextResponse.json({
					error: 'Tabel keamanan_surat_izin belum dibuat di Supabase. Silakan jalankan file migrations/add_role_keamanan_and_surat_izin.sql di SQL Editor Supabase terlebih dahulu.',
					tableReady: false,
				}, { status: 400 });
			}
			throw error;
		}

		return NextResponse.json({
			success: true,
			data,
			message: `Surat digital ${nomorSurat} berhasil diterbitkan.`,
		});
	} catch (err) {
		console.error('POST /api/keamanan/surat error:', err);
		return NextResponse.json({ error: err.message || 'Gagal menerbitkan surat' }, { status: 500 });
	}
}

// PATCH: Perbarui status surat (misal siswa kembali ke sekolah, atau dibatalkan)
export async function PATCH(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Keamanan') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Petugas Keamanan atau Admin yang dapat memperbarui status surat.' },
				{ status: 403 }
			);
		}

		const body = await req.json();
		const { id, status_surat, waktu_kembali, catatan } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID Surat wajib disertakan' }, { status: 400 });
		}

		const updates = {
			updated_at: new Date().toISOString(),
		};

		if (status_surat) updates.status_surat = status_surat; // 'aktif' | 'selesai' | 'dibatalkan'
		if (waktu_kembali) updates.waktu_kembali = waktu_kembali;
		if (catatan !== undefined) updates.catatan = catatan;

		const { data, error } = await supabaseAdmin
			.from('keamanan_surat_izin')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (error) throw error;

		return NextResponse.json({
			success: true,
			data,
			message: 'Status surat berhasil diperbarui.',
		});
	} catch (err) {
		console.error('PATCH /api/keamanan/surat error:', err);
		return NextResponse.json({ error: err.message || 'Gagal memperbarui status surat' }, { status: 500 });
	}
}

// DELETE: Hapus surat jika terjadi kesalahan fatal
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Keamanan') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Petugas Keamanan atau Admin yang dapat menghapus surat.' },
				{ status: 403 }
			);
		}

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID Surat wajib disertakan' }, { status: 400 });
		}

		const { error } = await supabaseAdmin
			.from('keamanan_surat_izin')
			.delete()
			.eq('id', id);

		if (error) throw error;

		return NextResponse.json({
			success: true,
			message: 'Surat berhasil dihapus.',
		});
	} catch (err) {
		console.error('DELETE /api/keamanan/surat error:', err);
		return NextResponse.json({ error: err.message || 'Gagal menghapus surat' }, { status: 500 });
	}
}
