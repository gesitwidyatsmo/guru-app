import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/utils/supabase/admin';

// --- METHOD GET (Ambil Data) ---
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const status = searchParams.get('status');
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const supabase = await createClient();
		let allowedClasses = null;

		if (role === 'Guru' && userId) {
			const { data: kbmData } = await supabase
				.from('guru_kbm')
				.select('kelas')
				.eq('id_user', userId);
			if (kbmData) {
				allowedClasses = [...new Set(kbmData.map(r => r.kelas))];
			} else {
				allowedClasses = [];
			}
		}

		// Jika akses publik (tanpa role), gunakan supabaseAdmin untuk bypass RLS
		const supabaseClient = role ? await createClient() : supabaseAdmin;

		let query = supabaseClient.from('siswa').select('*').order('nama_lengkap', { ascending: true });

		if (allowedClasses !== null) {
			if (allowedClasses.length === 0) return NextResponse.json([]);
			query = query.in('kelas', allowedClasses);
		}
		
		if (kelas) query = query.eq('kelas', kelas);
		if (status) query = query.eq('status', status);

		const { data: siswaList, error } = await query;
		if (error) throw error;

		return NextResponse.json(siswaList || []);
	} catch (error) {
		console.error('GET Siswa Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD POST (Tambah Data Baru - Manual & Bulk) ---
export async function POST(request) {
	const role = request.headers.get('x-user-role');
	if (role !== 'Admin' && role !== 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Guru)' }, { status: 403 });
	}
	try {
		const contentType = request.headers.get('content-type') || '';


		// === CASE 1: INPUT MANUAL (JSON) ===
		if (contentType.includes('application/json')) {
			const body = await request.json();
			const { nis, nama_lengkap, kelas, jenis_kelamin, status } = body;

			if (!nama_lengkap || !kelas) {
				return NextResponse.json({ error: 'Nama Lengkap dan Kelas wajib diisi' }, { status: 400 });
			}

			const uniqueId = 'SIS-' + Date.now() + Math.floor(Math.random() * 100);
			const { error } = await supabaseAdmin.from('siswa').insert({
				id: uniqueId,
				nis: nis || null,
				nama_lengkap,
				kelas,
				jenis_kelamin: jenis_kelamin || 'Laki-laki',
				status: status || 'Aktif',
			});

			if (error) throw error;
			return NextResponse.json({ success: true, message: 'Berhasil menambah siswa baru' });
		}

		// === CASE 2: BULK IMPORT (FormData) ===
		const formData = await request.formData();
		const file = formData.get('file');
		const kelasTarget = formData.get('kelas_target');

		if (!file) return NextResponse.json({ error: 'Tidak ada file' }, { status: 400 });
		if (!kelasTarget) return NextResponse.json({ error: 'Kelas target hilang' }, { status: 400 });

		const arrayBuffer = await file.arrayBuffer();
		const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		// range: 3 untuk skip baris 1-3 jika format excelnya menggunakan header di baris 4
		let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 3 });
		
		// Fallback jika kosong, coba tanpa range
		if (jsonData.length === 0) {
			jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
		}

		if (jsonData.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });

		const studentsToInsert = jsonData
			.map((row) => ({
				id: 'SIS-' + Date.now() + Math.floor(Math.random() * 10000) + Math.random().toString(36).substring(7),
				nis: String(row['NIS'] || row['nis'] || ''),
				nama_lengkap: row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || '',
				kelas: kelasTarget,
				jenis_kelamin: row['Jenis Kelamin'] || row['jenis_kelamin'] || 'Laki-laki',
				status: 'Aktif',
			}))
			.filter((s) => s.nama_lengkap);

		if (studentsToInsert.length === 0) {
			return NextResponse.json({ error: 'Data tidak valid. Pastikan kolom Nama terisi.' }, { status: 400 });
		}

		const { error } = await supabaseAdmin.from('siswa').insert(studentsToInsert);
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Import berhasil', total: studentsToInsert.length });
	} catch (error) {
		console.error('POST Error:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// --- METHOD PUT (Update Data) ---
export async function PUT(req) {
	const role = req.headers.get('x-user-role');
	if (role !== 'Admin' && role !== 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Guru)' }, { status: 403 });
	}
	try {
		const body = await req.json();
		const { id, nis, nama_lengkap, kelas, jenis_kelamin, status } = body;

		if (!id) return NextResponse.json({ error: 'ID tidak ditemukan' }, { status: 400 });


		const updates = {};
		if (nis !== undefined) updates.nis = nis;
		if (nama_lengkap !== undefined) updates.nama_lengkap = nama_lengkap;
		if (kelas !== undefined) updates.kelas = kelas;
		if (jenis_kelamin !== undefined) updates.jenis_kelamin = jenis_kelamin;
		if (status !== undefined) updates.status = status;

		const { error } = await supabaseAdmin.from('siswa').update(updates).eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
	} catch (error) {
		console.error('PUT Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD DELETE (Hapus Data) ---
export async function DELETE(req) {
	const role = req.headers.get('x-user-role');
	if (role !== 'Admin' && role !== 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Guru)' }, { status: 403 });
	}
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		// Cek apakah siswa memiliki riwayat akademik masa lalu (nilai, absensi, poin)
		const [resNilai, resAbsenH, resAbsenM, resPoin] = await Promise.all([
			supabaseAdmin.from('nilai_siswa').select('id', { count: 'exact', head: true }).eq('siswa_id', id),
			supabaseAdmin.from('absensi_harian_siswa').select('id', { count: 'exact', head: true }).eq('siswa_id', id),
			supabaseAdmin.from('absensi_mapel_siswa').select('id', { count: 'exact', head: true }).eq('siswa_id', id),
			supabaseAdmin.from('poin').select('id', { count: 'exact', head: true }).eq('siswa_id', id),
		]);

		const totalRecords = (resNilai.count || 0) + (resAbsenH.count || 0) + (resAbsenM.count || 0) + (resPoin.count || 0);

		if (totalRecords > 0) {
			return NextResponse.json({
				error: 'Siswa ini memiliki riwayat akademik (nilai/absensi/poin) pada periode sebelumnya. Untuk menjaga keutuhan data arsip dan rapor sekolah, ubah status siswa menjadi "Pindah", "Lulus", atau "Non-Aktif" alih-alih menghapusnya.',
				hasHistory: true,
				totalRecords,
			}, { status: 400 });
		}

		const { error } = await supabaseAdmin.from('siswa').delete().eq('id', id);
		
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Siswa berhasil dihapus' });
	} catch (error) {
		console.error('DELETE Error:', error);
		return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}
