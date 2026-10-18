import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const filterKelas = searchParams.get('kelas');
		const filterStatus = searchParams.get('status');
		const search = searchParams.get('search');

		// 1. Ambil data kelas untuk memetakan nama wali kelas
		const { data: kelasListRaw } = await supabaseAdmin
			.from('kelas')
			.select('id, nama_kelas, wali_kelas')
			.order('nama_kelas', { ascending: true });

		const waliKelasMap = {};
		const kelasList = [];
		(kelasListRaw || []).forEach((k) => {
			if (k.nama_kelas) {
				kelasList.push({ id: k.id, nama_kelas: k.nama_kelas, wali_kelas: k.wali_kelas || '' });
				waliKelasMap[k.nama_kelas] = k.wali_kelas || 'Wali Kelas';
			}
		});

		// 2. Ambil data seluruh siswa aktif
		const { data: allSiswaRaw, error: errSiswa } = await supabaseAdmin
			.from('siswa')
			.select('id, nis, nama_lengkap, kelas, jenis_kelamin, status')
			.eq('status', 'Aktif')
			.order('kelas', { ascending: true })
			.order('nama_lengkap', { ascending: true })
			.limit(2000);

		if (errSiswa) {
			console.error('Error fetching allSiswa:', errSiswa);
		}

		const allSiswa = allSiswaRaw || [];

		// 3. Ambil data penanganan santri
		let query = supabaseAdmin
			.from('kesiswaan_penanganan_santri')
			.select(`
				id,
				siswa_id,
				nama_santri,
				kelas,
				wali_kelas_id,
				wali_kelas_nama,
				jenis_pelanggaran,
				jumlah_alpa,
				tanggal_bimbingan,
				bentuk_penanganan,
				hasil_catatan,
				status,
				rekomendasi_tindak_lanjut,
				catatan_kesiswaan,
				created_by,
				created_at,
				updated_at
			`)
			.order('created_at', { ascending: false });

		if (filterKelas && filterKelas !== 'Semua') {
			query = query.eq('kelas', filterKelas);
		}
		if (filterStatus && filterStatus !== 'Semua') {
			query = query.eq('status', filterStatus);
		}

		let isTableReady = true;
		const { data: penangananListRaw, error: errPenanganan } = await query;
		let penangananList = [];

		if (errPenanganan) {
			console.warn('Tabel kesiswaan_penanganan_santri belum siap atau error:', errPenanganan.message);
			isTableReady = false;
			penangananList = [];
		} else {
			penangananList = penangananListRaw || [];
		}

		// Filter pencarian nama / kelas jika ada
		if (search && search.trim() !== '') {
			const s = search.toLowerCase();
			penangananList = penangananList.filter(
				(item) =>
					(item.nama_santri && item.nama_santri.toLowerCase().includes(s)) ||
					(item.kelas && item.kelas.toLowerCase().includes(s)) ||
					(item.wali_kelas_nama && item.wali_kelas_nama.toLowerCase().includes(s)) ||
					(item.jenis_pelanggaran && item.jenis_pelanggaran.toLowerCase().includes(s))
			);
		}

		// Hitung ringkasan status
		const summary = {
			total: penangananList.length,
			menungguBimbingan: penangananList.filter((p) => p.status === 'Menunggu Bimbingan').length,
			sudahDibina: penangananList.filter((p) => p.status === 'Sudah Dibina').length,
			perluPanggilanOrtu: penangananList.filter((p) => p.status === 'Perlu Panggilan Orang Tua').length,
			selesai: penangananList.filter((p) => p.status === 'Selesai').length,
		};

		return NextResponse.json({
			success: true,
			isTableReady,
			penangananList,
			summary,
			kelasList,
			waliKelasMap,
			allSiswa,
		});
	} catch (err) {
		console.error('API Penanganan GET Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const {
			siswa_id,
			nama_santri,
			kelas,
			wali_kelas_id,
			wali_kelas_nama,
			jenis_pelanggaran,
			jumlah_alpa,
			tanggal_bimbingan,
			bentuk_penanganan,
			hasil_catatan,
			status,
			rekomendasi_tindak_lanjut,
			catatan_kesiswaan,
			created_by,
		} = body;

		if (!siswa_id || !nama_santri || !kelas) {
			return NextResponse.json(
				{ error: 'Nama Santri, Siswa ID, dan Kelas wajib diisi' },
				{ status: 400 }
			);
		}

		if (!bentuk_penanganan || !hasil_catatan) {
			return NextResponse.json(
				{ error: 'Bentuk Penanganan dan Hasil/Catatan wajib diisi' },
				{ status: 400 }
			);
		}

		const newRecord = {
			siswa_id: String(siswa_id),
			nama_santri,
			kelas,
			wali_kelas_id: wali_kelas_id || null,
			wali_kelas_nama: wali_kelas_nama || 'Wali Kelas',
			jenis_pelanggaran: jenis_pelanggaran || 'Bolos Jam Pelajaran',
			jumlah_alpa: Number(jumlah_alpa) || 1,
			tanggal_bimbingan: tanggal_bimbingan || new Date().toISOString().slice(0, 10),
			bentuk_penanganan,
			hasil_catatan,
			status: status || 'Sudah Dibina',
			rekomendasi_tindak_lanjut: rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas',
			catatan_kesiswaan: catatan_kesiswaan || null,
			created_by: created_by || 'Kesiswaan',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const { data, error } = await supabaseAdmin
			.from('kesiswaan_penanganan_santri')
			.insert([newRecord])
			.select()
			.single();

		if (error) {
			console.error('Error insert penanganan santri:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Laporan penanganan santri berhasil disimpan.',
			data,
		});
	} catch (err) {
		console.error('API Penanganan POST Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const { id, ...updates } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID penanganan santri diperlukan' }, { status: 400 });
		}

		updates.updated_at = new Date().toISOString();

		const { data, error } = await supabaseAdmin
			.from('kesiswaan_penanganan_santri')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error update penanganan santri:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Data penanganan santri berhasil diperbarui.',
			data,
		});
	} catch (err) {
		console.error('API Penanganan PUT Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID penanganan santri diperlukan' }, { status: 400 });
		}

		const { error } = await supabaseAdmin
			.from('kesiswaan_penanganan_santri')
			.delete()
			.eq('id', id);

		if (error) {
			console.error('Error delete penanganan santri:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Laporan penanganan santri berhasil dihapus.',
		});
	} catch (err) {
		console.error('API Penanganan DELETE Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
