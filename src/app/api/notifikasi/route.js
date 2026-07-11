import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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
			// 1. Dapatkan hari dan tanggal ini
			const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
			const dateObj = new Date();
			// Sesuaikan timezone ke WIB (GMT+7) jika server di UTC
			const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
			const formatter = new Intl.DateTimeFormat('en-CA', options);
			const todayString = formatter.format(dateObj); // YYYY-MM-DD
			const hariIni = namaHari[dateObj.getDay()];

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
					.gte('created_at', `${todayString}T00:00:00Z`)
					.lte('created_at', `${todayString}T23:59:59Z`);

				const existingNotif = notifHariIni || [];
				const newNotificationsToInsert = [];

				// 5. Cek mana yang bolong
				for (const jadwal of jadwalHariIni) {
					// Asumsi: Jurnal terhubung dengan mapel dan kelas yang sama dengan jadwal
					const sudahDiisi = jurnalHariIni?.some(
						(jurnal) => jurnal.mapel === jadwal.mapel && jurnal.kelas === jadwal.kelas
					);

					if (!sudahDiisi) {
						const pesanReminder = `Jurnal untuk pelajaran ${jadwal.mapel} di kelas ${jadwal.kelas} hari ini belum diisi.`;
						
						// Cek apakah notifikasi untuk pesan ini sudah ada hari ini
						const sudahAdaNotif = existingNotif.some(n => n.pesan === pesanReminder);
						
						if (!sudahAdaNotif) {
							newNotificationsToInsert.push({
								user_id: userId,
								tipe: 'reminder_jurnal',
								judul: 'Peringatan Jurnal Belum Diisi',
								pesan: pesanReminder,
								action_url: '/jurnal',
								is_read: false
							});
						}
					}
				}

				// 6. Insert notifikasi baru jika ada
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

		const supabase = await createClient();

		let userIdsToInsert = [];

		if (target_user_id === 'all') {
			// Ambil semua user_id (Guru & Murid/Admin tergantung kebutuhan, biasanya semua Guru)
			// Disini kita broadcast ke role Guru
			const { data: allUsers } = await supabase.from('users').select('id').eq('role', 'Guru');
			if (allUsers) {
				userIdsToInsert = allUsers.map(u => u.id);
			}
		} else {
			userIdsToInsert = [target_user_id];
		}

		if (userIdsToInsert.length === 0) {
			return NextResponse.json({ error: 'Tidak ada target user yang valid.' }, { status: 400 });
		}

		const payload = userIdsToInsert.map(id => ({
			user_id: id,
			tipe: 'pengumuman',
			judul: judul,
			pesan: pesan,
			action_url: null,
			is_read: false
		}));

		const { error } = await supabase.from('notifikasi').insert(payload);
		if (error) throw error;

		return NextResponse.json({ success: true, message: `Berhasil mengirim ke ${payload.length} pengguna.` });
	} catch (error) {
		console.error('POST Notifikasi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
