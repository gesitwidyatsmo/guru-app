import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { hashPassword } from '@/lib/auth';

const SHEET_USERS = 'MASTER_USERS';

export async function PUT(req) {
	try {
		// Endpoint Self-Service: Hanya mengecek ID orang yang sedang login, tidak peduli dia Admin atau Guru
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Akses Ditolak: Invalid Session.' }, { status: 401 });
		}

		const body = await req.json();
		const { nama_lengkap, password_baru } = body;

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_USERS];
		if (!sheet) {
			return NextResponse.json({ error: 'Database Pengguna tidak bereaksi.' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const targetRow = rows.find((r) => String(r.get('id_user')) === String(userId));

		if (!targetRow) {
			return NextResponse.json({ error: 'Sistem tidak menemukan profil akun Anda.' }, { status: 404 });
		}

		// Update Profil Mandiri
		if (nama_lengkap && nama_lengkap.trim() !== '') {
			targetRow.set('nama_lengkap', nama_lengkap);
		}

		// Update Kata Sandi Mandiri
		if (password_baru && password_baru.trim() !== '') {
			const newHash = await hashPassword(password_baru);
			targetRow.set('password_hash', newHash);
		}

		await targetRow.save();

		return NextResponse.json({ success: true, message: 'Profil Anda berhasil divalidasi dan diperbarui.' }, { status: 200 });
	} catch (error) {
		console.error('Error PUT Profil Akun:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan pembaruan sistem.' }, { status: 500 });
	}
}
