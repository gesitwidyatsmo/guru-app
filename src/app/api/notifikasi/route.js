import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const supabase = await createClient();

		// ======== LAZY EVALUATION UNTUK REMINDER JURNAL (Khusus Guru) ========
		if (role === 'Guru') {
			// 1. Dapatkan hari dan tanggal ini (konsisten menggunakan timezone WIB/Asia/Jakarta)
			const dateObj = new Date();
			// todayString: YYYY-MM-DD dalam WIB
			const todayString = new Intl.DateTimeFormat('en-CA', {
				timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
			}).format(dateObj);

			const hariIni = new Intl.DateTimeFormat('id-ID', {
				timeZone: 'Asia/Jakarta', weekday: 'long',
			}).format(dateObj); // "Senin", "Selasa", dst — sesuai kolom 'hari' di tabel jadwal

			// Konversi batas 00:00:00 s.d. 23:59:59.999 WIB ke ISO string UTC untuk query PostgreSQL yang akurat
			const startOfDayUTC = new Date(`${todayString}T00:00:00+07:00`).toISOString();
			const endOfDayUTC = new Date(`${todayString}T23:59:59.999+07:00`).toISOString();

			// Otomatis tandai reminder_jurnal lama (hari-hari sebelumnya) yang belum dibaca sebagai is_read: true
			// agar tidak menumpuk memenuhi badge di hari berikutnya
			await supabase
				.from('notifikasi')
				.update({ is_read: true })
				.eq('user_id', userId)
				.eq('tipe', 'reminder_jurnal')
				.eq('is_read', false)
				.lt('created_at', startOfDayUTC);

			// 2. Ambil Jadwal hari ini
			const { data: jadwalHariIni } = await supabase
				.from('jadwal')
				.select('*')
				.eq('id_user', userId)
				.eq('hari', hariIni);

			if (jadwalHariIni && jadwalHariIni.length > 0) {
				// 3. Ambil Jurnal yang sudah diisi hari ini
				const { data: jurnalHariIni } = await supabase
					.from('jurnal')
					.select('*')
					.eq('guru_id', userId)
					.eq('tanggal', todayString);

				// 4. Ambil Notifikasi reminder_jurnal yang sudah ada untuk hari ini
				const { data: notifHariIni } = await supabase
					.from('notifikasi')
					.select('*')
					.eq('user_id', userId)
					.eq('tipe', 'reminder_jurnal')
					.gte('created_at', startOfDayUTC)
					.lte('created_at', endOfDayUTC);

				const existingNotif = notifHariIni || [];
				const newNotificationsToInsert = [];
				const notifIdsToMarkRead = [];

				// 5. Kelompokkan jadwal menjadi mapel & kelas unik (mencegah duplikasi jam mengajar ganda)
				const uniqueJadwalMap = new Map();
				for (const j of jadwalHariIni) {
					const key = `${(j.mapel || '').trim().toUpperCase()}__${(j.kelas || '').trim().toUpperCase()}`;
					if (!uniqueJadwalMap.has(key)) {
						uniqueJadwalMap.set(key, j);
					}
				}

				// 6. Evaluasi setiap kelas & mapel
				for (const [, jadwal] of uniqueJadwalMap) {
					const sudahDiisi = jurnalHariIni?.some(
						(jurnal) =>
							(jurnal.mapel || '').trim().toUpperCase() === (jadwal.mapel || '').trim().toUpperCase() &&
							(jurnal.kelas || '').trim().toUpperCase() === (jadwal.kelas || '').trim().toUpperCase()
					);

					const pesanReminder = `Jurnal untuk pelajaran ${jadwal.mapel} di kelas ${jadwal.kelas} hari ini belum diisi.`;
					const notifTerkait = existingNotif.filter((n) => n.pesan === pesanReminder);

					if (sudahDiisi) {
						// Jika sudah diisi hari ini, otomatis tandai notifikasi pengingatnya menjadi is_read
						for (const n of notifTerkait) {
							if (!n.is_read) {
								notifIdsToMarkRead.push(n.id);
							}
						}
					} else {
						// Jika belum diisi dan belum pernah ada notifikasi pengingat untuk hari ini
						if (notifTerkait.length === 0) {
							newNotificationsToInsert.push({
								user_id: userId,
								tipe: 'reminder_jurnal',
								judul: 'Peringatan Jurnal Belum Diisi',
								pesan: pesanReminder,
								action_url: '/jurnal',
								is_read: false,
							});
						}
					}
				}

				// Update yang sudah diisi menjadi read
				if (notifIdsToMarkRead.length > 0) {
					await supabase
						.from('notifikasi')
						.update({ is_read: true })
						.in('id', notifIdsToMarkRead);
				}

				// Insert notifikasi baru jika belum ada
				if (newNotificationsToInsert.length > 0) {
					await supabase.from('notifikasi').insert(newNotificationsToInsert);
				}
			}
		}
		// ======================================================================

		// 7. Ambil semua notifikasi terbaru pengguna (limit 50)
		const { data: notifikasi, error } = await supabase
			.from('notifikasi')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(50);

		if (error) throw error;

		return NextResponse.json(notifikasi || []);
	} catch (error) {
		console.error('GET Notifikasi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function PATCH(req) {
	try {
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const supabase = await createClient();

		// Tandai semua notifikasi pengguna ini sebagai sudah dibaca
		const { error } = await supabase
			.from('notifikasi')
			.update({ is_read: true })
			.eq('user_id', userId)
			.eq('is_read', false);

		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
	} catch (error) {
		console.error('PATCH All Notifikasi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Hanya Admin yang dapat mengirim pengumuman broadcast.' }, { status: 403 });
		}

		const body = await req.json();
		const { judul, pesan, target_user_id } = body;

		if (!judul || !pesan) {
			return NextResponse.json({ error: 'Judul dan pesan wajib diisi.' }, { status: 400 });
		}

		let userIdsToInsert = [];

		if (target_user_id === 'all') {
			// Ambil semua id_user dari dewan Guru menggunakan supabaseAdmin (bypass RLS)
			const { data: allUsers, error: usersErr } = await supabaseAdmin
				.from('users')
				.select('id_user')
				.eq('role', 'Guru');

			if (usersErr) throw usersErr;

			if (allUsers && allUsers.length > 0) {
				userIdsToInsert = allUsers.map((u) => u.id_user).filter(Boolean);
			}
		} else {
			userIdsToInsert = [target_user_id].filter(Boolean);
		}

		if (userIdsToInsert.length === 0) {
			return NextResponse.json({ error: 'Tidak ada target user yang valid.' }, { status: 400 });
		}

		const payload = userIdsToInsert.map((id) => ({
			user_id: id,
			tipe: 'pengumuman',
			judul: judul,
			pesan: pesan,
			action_url: null,
			is_read: false,
		}));

		const { error: insertError } = await supabaseAdmin.from('notifikasi').insert(payload);
		if (insertError) throw insertError;

		return NextResponse.json({ success: true, message: `Berhasil mengirim pengumuman ke ${payload.length} pengguna.` });
	} catch (error) {
		console.error('POST Notifikasi Error:', error);
		return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
	}
}
