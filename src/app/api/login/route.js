import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { createToken, comparePassword, hashPassword } from '@/lib/auth';

const SHEET_USERS = 'MASTER_USERS';
const SHEET_KBM = 'GURU_KBM';

export async function POST(req) {
	try {
		const { username, password } = await req.json();

		if (!username || !password) {
			return NextResponse.json({ error: 'Username dan Password wajib diisi.' }, { status: 400 });
		}

		// Ambil data doc dari Google Sheets
		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_USERS];

		// AUTO-SEED: Jika Sheet MASTER_USERS tidak ditemukan, maka inisialisasi Setup Awal
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_USERS,
				headerValues: ['id_user', 'username', 'password_hash', 'nama_lengkap', 'role'],
			});

			const defaultHash = await hashPassword('admin123'); // Password Default

			await sheet.addRow({
				id_user: 'UID-000',
				username: 'admin',
				password_hash: defaultHash,
				nama_lengkap: 'Super Admin',
				role: 'Admin',
			});

			// Sekalian buat GURU_KBM jika belum ada
			if (!doc.sheetsByTitle[SHEET_KBM]) {
				await doc.addSheet({
					title: SHEET_KBM,
					headerValues: ['id_user', 'kelas', 'mapel'],
				});
			}

			// Lakukan reload untuk membaca data yang baru ditambahkan
			await doc.loadInfo();
			sheet = doc.sheetsByTitle[SHEET_USERS];
		}

		const rows = await sheet.getRows();
		const mappedUsers = rows.map((r) => ({
			id_user: r.get('id_user'),
			username: r.get('username'),
			password_hash: r.get('password_hash'),
			nama_lengkap: r.get('nama_lengkap'),
			role: r.get('role'),
		}));

		// Cari user (Case-insensitive)
		const user = mappedUsers.find((u) => u.username?.toLowerCase() === username.toLowerCase());

		if (!user) {
			return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 401 });
		}

		// Gunakan bcrypt compare (Pastikan formating hash benar di Google Sheets, bukan plaintext)
		const isPasswordValid = await comparePassword(password, user.password_hash);

		// Fallback (Sementara jika ada dev yang masih isi plaintext di Sheets)
		// Jika password_hash belum ter-hash (masih plaintext) - Ini opsi pelonggaran
		const isPlainMatch = password === user.password_hash;

		if (!isPasswordValid && !isPlainMatch) {
			return NextResponse.json({ error: 'Kredensial Anda salah.' }, { status: 401 });
		}

		// Berhasil Login, persiapkan payload token
		const tokenPayload = {
			id: user.id_user,
			username: user.username,
			nama_lengkap: user.nama_lengkap,
			role: user.role, // Admin | Guru
		};

		// Cetak JWT
		const token = await createToken(tokenPayload);

		// Sematkan JWT ke Cookie Browser (HttpOnly untuk keamanan dari XSS)
		const response = NextResponse.json(
			{
				message: 'Login sukses',
				user: tokenPayload,
			},
			{ status: 200 },
		);

		// Set cookie
		response.cookies.set('token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24, // 24 Jam
			path: '/',
		});

		return response;
	} catch (error) {
		console.error('Error saat Login:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem internal.' }, { status: 500 });
	}
}
