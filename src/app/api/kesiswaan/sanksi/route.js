import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { getTodayDateString } from '@/lib/dateUtils';

// Helper nomor surat otomatis
function generateNoSurat(jenis = 'SP1') {
	const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
	const date = new Date();
	const month = romanMonths[date.getMonth()];
	const year = date.getFullYear();
	const randomNum = Math.floor(100 + Math.random() * 900);
	return `${randomNum}/${jenis}/KSW/${month}/${year}`;
}

// ===========================================================================
// GET /api/kesiswaan/sanksi - Ambil Data Sanksi & Surat Peringatan
// ===========================================================================
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const allowedRoles = ['Admin', 'Kesiswaan', 'Kepala Sekolah', 'Guru'];
		if (role && !allowedRoles.includes(role)) {
			return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const status = searchParams.get('status');
		const jenis = searchParams.get('jenis');
		const siswa_id = searchParams.get('siswa_id');

		const supabase = await createClient();

		let query = supabase
			.from('kesiswaan_sanksi')
			.select(`
				*,
				siswa:siswa_id (
					id,
					nama_lengkap,
					nis,
					kelas,
					jenis_kelamin
				),
				pembuat:diterbitkan_oleh (
					id_user,
					nama_lengkap,
					role
				)
			`)
			.order('created_at', { ascending: false });

		if (status) query = query.eq('status_penyelesaian', status);
		if (jenis) query = query.eq('jenis_sanksi', jenis);
		if (siswa_id) query = query.eq('siswa_id', siswa_id);

		const { data, error } = await query;

		if (error) {
			// Jika tabel belum dibuat atau error skema, kembalikan array kosong gracefully
			console.error('Error fetching sanksi:', error.message);
			return NextResponse.json([]);
		}

		return NextResponse.json(data || []);
	} catch (err) {
		console.error('GET /api/kesiswaan/sanksi error:', err);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}

// ===========================================================================
// POST /api/kesiswaan/sanksi - Terbitkan Sanksi / SP Baru
// ===========================================================================
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Kesiswaan') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Tim Kesiswaan atau Administrator yang dapat menerbitkan sanksi/SP.' },
				{ status: 403 }
			);
		}

		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const {
			siswa_id,
			jenis_sanksi,
			alasan,
			no_surat,
			akumulasi_poin_saat_terbit,
			tanggal_terbit,
			tanggal_panggilan,
			batas_waktu_skorsing,
			tindak_lanjut,
			berkas_lampiran,
			tahun_ajar_id,
			semester,
		} = body;

		if (!siswa_id || !jenis_sanksi || !alasan) {
			return NextResponse.json(
				{ error: 'Siswa, jenis sanksi, dan alasan wajib diisi.' },
				{ status: 400 }
			);
		}

		const insertPayload = {
			no_surat: no_surat || generateNoSurat(jenis_sanksi),
			siswa_id,
			jenis_sanksi,
			alasan,
			akumulasi_poin_saat_terbit: parseInt(akumulasi_poin_saat_terbit || 0, 10),
			tanggal_terbit: tanggal_terbit || getTodayDateString(),
			tanggal_panggilan: tanggal_panggilan || null,
			batas_waktu_skorsing: batas_waktu_skorsing || null,
			status_penyelesaian: 'Menunggu',
			tindak_lanjut: tindak_lanjut || null,
			diterbitkan_oleh: userId || null,
			berkas_lampiran: berkas_lampiran || null,
			tahun_ajar_id: tahun_ajar_id || null,
			semester: semester ? parseInt(semester, 10) : 1,
		};

		const supabase = await createClient();
		const { data, error } = await supabase
			.from('kesiswaan_sanksi')
			.insert(insertPayload)
			.select()
			.single();

		if (error) {
			console.error('Insert sanksi error:', error.message);
			return NextResponse.json({ error: `Gagal menerbitkan sanksi: ${error.message}` }, { status: 500 });
		}

		return NextResponse.json({ success: true, data }, { status: 201 });
	} catch (err) {
		console.error('POST /api/kesiswaan/sanksi error:', err);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}

// ===========================================================================
// PUT /api/kesiswaan/sanksi - Update Status / Tindak Lanjut Sanksi
// ===========================================================================
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Kesiswaan') {
			return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
		}

		const body = await req.json();
		const { id, status_penyelesaian, tindak_lanjut, tanggal_panggilan, batas_waktu_skorsing } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID sanksi wajib dikirimkan' }, { status: 400 });
		}

		const updates = {
			updated_at: new Date().toISOString(),
		};
		if (status_penyelesaian) updates.status_penyelesaian = status_penyelesaian;
		if (tindak_lanjut !== undefined) updates.tindak_lanjut = tindak_lanjut;
		if (tanggal_panggilan !== undefined) updates.tanggal_panggilan = tanggal_panggilan;
		if (batas_waktu_skorsing !== undefined) updates.batas_waktu_skorsing = batas_waktu_skorsing;

		const supabase = await createClient();
		const { error } = await supabase.from('kesiswaan_sanksi').update(updates).eq('id', id);

		if (error) {
			console.error('Update sanksi error:', error.message);
			return NextResponse.json({ error: 'Gagal memperbarui status sanksi' }, { status: 500 });
		}

		return NextResponse.json({ success: true, message: 'Status sanksi berhasil diperbarui' });
	} catch (err) {
		console.error('PUT /api/kesiswaan/sanksi error:', err);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}

// ===========================================================================
// DELETE /api/kesiswaan/sanksi - Hapus Record Sanksi
// ===========================================================================
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin' && role !== 'Kesiswaan') {
			return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID sanksi wajib disertakan' }, { status: 400 });
		}

		const supabase = await createClient();
		const { error } = await supabase.from('kesiswaan_sanksi').delete().eq('id', id);

		if (error) {
			console.error('Delete sanksi error:', error.message);
			return NextResponse.json({ error: 'Gagal menghapus sanksi' }, { status: 500 });
		}

		return NextResponse.json({ success: true, message: 'Data sanksi berhasil dihapus' });
	} catch (err) {
		console.error('DELETE /api/kesiswaan/sanksi error:', err);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}
