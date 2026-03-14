import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { hashPassword } from '@/lib/auth';

const SHEET_USERS = 'MASTER_USERS';

function generateUID() {
	return 'UID-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ---------------------------------------------------------------------------
// METHOD GET - Menampilkan Daftar Pengguna
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		// Validasi Proteksi API Level - Harus Admin
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Hanya Admin yang diizinkan mengelola daftar pengguna.' }, { status: 403 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_USERS];

		if (!sheet) {
			return NextResponse.json([]); // Belum ada data
		}

		const rows = await sheet.getRows();

		// Map dan sembunyikan password hash dari Client
		const users = rows.map((r) => ({
			id_user: r.get('id_user'),
			username: r.get('username'),
			nama_lengkap: r.get('nama_lengkap'),
			role: r.get('role'),
		}));

		// Filter untuk query, misal by role
		const { searchParams } = new URL(req.url);
		const filterRole = searchParams.get('role');

		let result = users;
		if (filterRole) {
			result = result.filter((u) => u.role === filterRole);
		}

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error('Error GET Pengguna:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD POST - Menambahkan Guru / Admin Baru
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { username, password, nama_lengkap, role } = await req.json();

		if (!username || !password || !nama_lengkap || !role) {
			return NextResponse.json({ error: 'Seluruh form data wajib dilengkapi.' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_USERS];

		// Jika tab MASTER_USERS tidak ada, asumsikan harus dibikin (Meski seharusnya di-handle login auto-seed)
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_USERS,
				headerValues: ['id_user', 'username', 'password_hash', 'nama_lengkap', 'role'],
			});
		}

		// Validasi duplikasi Username (Case-insensitive)
		const rows = await sheet.getRows();
		const isExists = rows.some((r) => r.get('username')?.toLowerCase() === username.toLowerCase());
		if (isExists) {
			return NextResponse.json({ error: `Username '${username}' sudah dipakai pengguna lain.` }, { status: 409 });
		}

		const hashedPayload = await hashPassword(password);
		const newUserId = generateUID();

		await sheet.addRow({
			id_user: newUserId,
			username: username,
			password_hash: hashedPayload,
			nama_lengkap: nama_lengkap,
			role: role, // 'Admin' atau 'Guru'
		});

		return NextResponse.json({ success: true, message: 'Akun berhasil ditambahkan', id: newUserId }, { status: 201 });
	} catch (error) {
		console.error('Error POST Pengguna:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD PUT - Modifikasi Data / Reset Password
// ---------------------------------------------------------------------------
export async function PUT(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const { id_user, username, nama_lengkap, role, password_baru } = body;

		if (!id_user) {
			return NextResponse.json({ error: 'Parameter id_user diperlukan.' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_USERS];
		if (!sheet) {
			return NextResponse.json({ error: 'Sheet Akun tidak tersedia.' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const targetRow = rows.find((r) => r.get('id_user') === id_user);

		if (!targetRow) {
			return NextResponse.json({ error: 'Sistem tidak menemukan akun ini.' }, { status: 404 });
		}

		// Cek Duplikasi Username bila berganti username
		if (username !== targetRow.get('username')) {
			const isExists = rows.some((r) => r.get('username')?.toLowerCase() === username.toLowerCase());
			if (isExists) {
				return NextResponse.json({ error: `Username '${username}' sudah ada yang menggunakan.` }, { status: 409 });
			}
			targetRow.set('username', username);
		}

		if (nama_lengkap) targetRow.set('nama_lengkap', nama_lengkap);
		if (role) targetRow.set('role', role);

		// Reset Sandi jika dikirim dari antarmuka
		if (password_baru && password_baru.trim() !== '') {
			const newHash = await hashPassword(password_baru);
			targetRow.set('password_hash', newHash);
		}

		await targetRow.save();
		return NextResponse.json({ success: true, message: 'Informasi pengguna berhasil dimutakhirkan.' }, { status: 200 });
	} catch (error) {
		console.error('Error PUT Pengguna:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan pembaruan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD DELETE - Mencabut Hak Akses
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id_user = searchParams.get('id_user');

		if (!id_user) {
			return NextResponse.json({ error: 'ID Pengguna wajib dikirimkan.' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_USERS];
		if (!sheet) {
			return NextResponse.json({ error: 'Sheet tidak ditemukan.' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const targetRow = rows.find((r) => r.get('id_user') === id_user);

		if (!targetRow) {
			return NextResponse.json({ error: 'Akun gagal dihapus (Tidak Ditemukan).' }, { status: 404 });
		}

		// Proteksi Bunuh Diri (Secara tidak sengaja menghapus dirinya yang login)
		const loggedInUserId = req.headers.get('x-user-id');
		if (loggedInUserId === id_user) {
			return NextResponse.json({ error: 'Peringatan: Anda tidak diizinkan menghapus akun Anda sendiri selagi aktif.' }, { status: 403 });
		}

		await targetRow.delete();

		// Cleanup: Jika Admin juga menghapus Guru, cabut otorisasi-nya dari GURU_KBM
		const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
		if (kbmSheet) {
			const kbmRows = await kbmSheet.getRows();
			const linkedKBMs = kbmRows.filter((r) => r.get('id_user') === id_user);
			for (const r of linkedKBMs) {
				await r.delete();
			}
		}

		return NextResponse.json({ success: true, message: 'Akun Pengguna dicabut selamanya.' }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE Pengguna:', error);
		return NextResponse.json({ error: 'Kegagalan komunikasi database internal.' }, { status: 500 });
	}
}
