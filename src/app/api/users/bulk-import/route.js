import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import * as XLSX from 'xlsx';

function generateUID() {
	return 'UID-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function sanitizeUsername(raw, fallbackName = '') {
	let text = String(raw || '').trim();
	if (!text && fallbackName) {
		text = String(fallbackName).trim();
	}
	return text
		.toLowerCase()
		.replace(/[^a-z0-9_.-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 30);
}

function normalizeRole(rawRole) {
	const r = String(rawRole || '').trim().toLowerCase();
	if (r.includes('admin')) return 'Admin';
	if (r.includes('kepala') || r.includes('kepsek')) return 'Kepala Sekolah';
	if (r.includes('benda') || r.includes('keuangan') || r.includes('finance')) return 'Bendahara';
	return 'Guru';
}

export async function POST(req) {
	try {
		// 1. Cek Hak Akses (Khusus Admin)
		let role = req.headers.get('x-user-role');
		if (!role) {
			const supabase = await createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: profile } = await supabaseAdmin
					.from('users')
					.select('role')
					.eq('auth_id', user.id)
					.maybeSingle();
				if (profile) role = profile.role;
			}
		}

		if (role !== 'Admin') {
			return NextResponse.json(
				{ error: 'Akses Ditolak: Hanya Administrator yang diizinkan melakukan impor pengguna massal.' },
				{ status: 403 }
			);
		}

		// 2. Baca data dari FormData atau JSON Body
		const contentType = req.headers.get('content-type') || '';
		let rawUsers = [];
		let defaultPassword = 'guru123';

		if (contentType.includes('multipart/form-data')) {
			const formData = await req.formData();
			const file = formData.get('file');
			const customDefaultPassword = formData.get('default_password');
			if (customDefaultPassword && String(customDefaultPassword).trim()) {
				defaultPassword = String(customDefaultPassword).trim();
			}

			if (!file) {
				return NextResponse.json({ error: 'File Excel (.xlsx / .xls) wajib diunggah.' }, { status: 400 });
			}

			const arrayBuffer = await file.arrayBuffer();
			const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
			const sheetName = workbook.SheetNames[0];
			if (!sheetName || !workbook.Sheets[sheetName]) {
				return NextResponse.json({ error: 'Sheet pada file Excel tidak ditemukan atau kosong.' }, { status: 400 });
			}

			rawUsers = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
		} else if (contentType.includes('application/json')) {
			const body = await req.json();
			rawUsers = body.users || [];
			if (body.default_password && String(body.default_password).trim()) {
				defaultPassword = String(body.default_password).trim();
			}
		} else {
			return NextResponse.json(
				{ error: 'Format permintaan tidak didukung (harus multipart/form-data atau application/json).' },
				{ status: 415 }
			);
		}

		if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
			return NextResponse.json({ error: 'Tidak ada baris data pengguna yang ditemukan untuk diimpor.' }, { status: 400 });
		}

		// 3. Normalisasi & Validasi Awal Baris Data
		const parsedUsers = [];
		const skippedEmpty = [];
		const seenUsernamesInBatch = new Set();

		rawUsers.forEach((row, index) => {
			const rowNum = index + 2; // Asumsi baris 1 header
			const rawNama = row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || row['nama'] || row['Nama Guru'] || '';
			const rawUsername = row['Username'] || row['username'] || row['User'] || row['user'] || '';
			const rawRole = row['Role'] || row['role'] || row['Peran'] || row['peran'] || 'Guru';
			const rawPassword = row['Password'] || row['password'] || row['Kata Sandi'] || row['kata_sandi'] || row['Sandi'] || '';
			const rawNip = row['NIP'] || row['nip'] || row['Nomor Induk'] || '';

			// Jika baris kosong sama sekali, abaikan
			if (!rawNama && !rawUsername && !rawRole && !rawPassword && !rawNip) {
				skippedEmpty.push(rowNum);
				return;
			}

			const namaLengkap = String(rawNama).trim();
			let username = sanitizeUsername(rawUsername, namaLengkap);
			const roleNormalized = normalizeRole(rawRole);
			
			// Jika password kosong di Excel, gunakan defaultPassword ('guru123')
			let password = String(rawPassword).trim();
			let isUsingDefaultPassword = false;
			if (!password) {
				password = defaultPassword;
				isUsingDefaultPassword = true;
			}

			parsedUsers.push({
				rowNum,
				nama_lengkap: namaLengkap,
				nip: rawNip ? String(rawNip).trim() : null,
				username,
				role: roleNormalized,
				password,
				isUsingDefaultPassword,
			});
		});

		if (parsedUsers.length === 0) {
			return NextResponse.json(
				{ error: 'Seluruh baris dalam file Excel kosong atau tidak memiliki format yang sesuai.' },
				{ status: 400 }
			);
		}

		// 4. Eksekusi Pendaftaran Akun Per Baris
		const successes = [];
		const failures = [];

		for (const item of parsedUsers) {
			const { rowNum, nama_lengkap, username, role: userRole, password, isUsingDefaultPassword } = item;

			// Validasi Nama Lengkap
			if (!nama_lengkap || nama_lengkap.length < 2) {
				failures.push({
					row: rowNum,
					nama: nama_lengkap || '(Kosong)',
					username: username || '-',
					reason: 'Nama Lengkap wajib diisi (minimal 2 karakter).',
				});
				continue;
			}

			// Validasi Username
			if (!username || username.length < 3) {
				failures.push({
					row: rowNum,
					nama: nama_lengkap,
					username: username || '(Kosong)',
					reason: 'Username minimal 3 karakter dan hanya boleh berisi huruf, angka, titik, atau underscore.',
				});
				continue;
			}

			// Validasi duplikat dalam batch impor ini
			if (seenUsernamesInBatch.has(username)) {
				failures.push({
					row: rowNum,
					nama: nama_lengkap,
					username,
					reason: `Username '${username}' terduplikasi dalam file impor yang sama.`,
				});
				continue;
			}
			seenUsernamesInBatch.add(username);

			// Validasi panjang kata sandi (Supabase mensyaratkan minimal 6 karakter)
			if (password.length < 6) {
				failures.push({
					row: rowNum,
					nama: nama_lengkap,
					username,
					reason: `Kata sandi harus minimal 6 karakter. Default '${defaultPassword}' dapat digunakan jika dikosongkan.`,
				});
				continue;
			}

			try {
				// Cek apakah username sudah ada di tabel public.users
				const { data: existingUser, error: checkError } = await supabaseAdmin
					.from('users')
					.select('id_user, username')
					.eq('username', username)
					.maybeSingle();

				if (checkError) {
					console.error('Check Username Error:', checkError.message);
				}

				if (existingUser) {
					failures.push({
						row: rowNum,
						nama: nama_lengkap,
						username,
						reason: `Username '@${username}' sudah digunakan oleh pengguna lain di sistem.`,
					});
					continue;
				}

				// Buat akun di Supabase Auth
				const email = `${username}@guruapp.com`;
				const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
					email,
					password,
					email_confirm: true,
				});

				if (authError) {
					const errorMsg = authError.message.includes('already registered')
						? `Email/Username '@${username}' sudah terdaftar di otentikasi.`
						: authError.message;
					failures.push({
						row: rowNum,
						nama: nama_lengkap,
						username,
						reason: errorMsg,
					});
					continue;
				}

				// Buat profil pengguna di public.users
				const newUserId = generateUID();
				const insertProfilePayload = {
					id_user: newUserId,
					auth_id: authData.user.id,
					username,
					nama_lengkap,
					role: userRole,
				};
				if (item.nip) {
					insertProfilePayload.nip = item.nip;
				}
				const { error: profileError } = await supabaseAdmin.from('users').insert(insertProfilePayload);

				if (profileError) {
					// Rollback user Auth jika gagal simpan profil
					await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
					failures.push({
						row: rowNum,
						nama: nama_lengkap,
						username,
						reason: `Gagal simpan profil: ${profileError.message}`,
					});
					continue;
				}

				successes.push({
					row: rowNum,
					id_user: newUserId,
					nama: nama_lengkap,
					username,
					role: userRole,
					isDefaultPassword: isUsingDefaultPassword,
				});
			} catch (err) {
				failures.push({
					row: rowNum,
					nama: nama_lengkap,
					username,
					reason: err.message || 'Terjadi kesalahan sistem internal.',
				});
			}
		}

		return NextResponse.json({
			success: true,
			message: `Proses impor selesai: ${successes.length} berhasil, ${failures.length} gagal/dilewati.`,
			total: parsedUsers.length,
			successCount: successes.length,
			failCount: failures.length,
			defaultPasswordUsed: defaultPassword,
			successes,
			failures,
		}, { status: 200 });

	} catch (error) {
		console.error('Error Bulk Import Pengguna:', error);
		return NextResponse.json(
			{ error: `Terjadi kegagalan server: ${error.message}` },
			{ status: 500 }
		);
	}
}
