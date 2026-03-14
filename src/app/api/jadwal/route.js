import { getSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';

const SHEET_NAME = 'MASTER_JADWAL';
const generateRandomId = () => Math.floor(Math.random() * 100000).toString();

export async function GET(req) {
	try {
		const doc = await getSheet();
		// Jika sheet belum ada, tangani diam-diam
		let sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) {
			return NextResponse.json([]);
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Admin') {
			return NextResponse.json({ error: 'Admin tidak mengelola maupun mengatur jadwal personal Guru.' }, { status: 403 });
		}

		if (!userId) {
			return NextResponse.json({ error: 'Kredensial pengguna tidak valid.' }, { status: 401 });
		}

		const rows = await sheet.getRows();
		const userRow = rows.find((r) => String(r.get('id_user')) === String(userId));

		let jadwalArray = [];
		if (userRow) {
			try {
				jadwalArray = JSON.parse(userRow.get('jadwal_data') || '[]');
			} catch (e) {
				jadwalArray = [];
			}
		}

		// Kembalikan sortable array seperti sedia kala
		const sorted = jadwalArray.sort((a, b) => Number(a.jam_ke) - Number(b.jam_ke));
		return NextResponse.json(sorted);
	} catch (error) {
		console.error('GET Jadwal Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_NAME];

		// Jika sheet tidak ada, ciptakan dengan struktur header JSON teranyar
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_NAME,
				headerValues: ['id', 'id_user', 'jadwal_data'],
			});
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Admin') return NextResponse.json({ error: 'Terlarang bagi Admin.' }, { status: 403 });
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const newJadwalItem = {
			id: generateRandomId(),
			mapel: body.mapel,
			kelas: body.kelas,
			hari: body.hari,
			jam_ke: body.jam_ke || '',
			jam_mulai: body.jam_mulai,
			jam_selesai: body.jam_selesai,
		};

		const rows = await sheet.getRows();
		const userRow = rows.find((r) => String(r.get('id_user')) === String(userId));

		if (userRow) {
			let jadwalArray = [];
			try {
				jadwalArray = JSON.parse(userRow.get('jadwal_data') || '[]');
			} catch (e) {
				jadwalArray = [];
			}

			jadwalArray.push(newJadwalItem);
			userRow.set('jadwal_data', JSON.stringify(jadwalArray));
			await userRow.save();
		} else {
			// Buat baris kepemilikan baru untuk guru ini
			await sheet.addRow({
				id: generateRandomId(), // ID unik baris tabel
				id_user: userId,
				jadwal_data: JSON.stringify([newJadwalItem]),
			});
		}

		return NextResponse.json({ success: true, id: newJadwalItem.id }, { status: 201 });
	} catch (error) {
		console.error('POST Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal merekam jadwal baru.' }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Database tidak ditemukan' }, { status: 404 });

		const userId = req.headers.get('x-user-id');
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const rows = await sheet.getRows();
		const userRow = rows.find((r) => String(r.get('id_user')) === String(userId));

		if (userRow) {
			let jadwalArray = [];
			try {
				jadwalArray = JSON.parse(userRow.get('jadwal_data') || '[]');
			} catch (e) {}

			const itemIndex = jadwalArray.findIndex((item) => String(item.id) === String(body.id));
			if (itemIndex !== -1) {
				// Modifikasi memori RAM
				jadwalArray[itemIndex] = {
					...jadwalArray[itemIndex],
					mapel: body.mapel,
					kelas: body.kelas,
					hari: body.hari,
					jam_ke: body.jam_ke,
					jam_mulai: body.jam_mulai,
					jam_selesai: body.jam_selesai,
				};
				// Push ulang JSON ke Sheet
				userRow.set('jadwal_data', JSON.stringify(jadwalArray));
				await userRow.save();
				return NextResponse.json({ success: true });
			} else {
				return NextResponse.json({ error: 'ID sesi tidak ditemukan dalam riwayat jadwal Anda' }, { status: 404 });
			}
		}

		return NextResponse.json({ error: 'Belum ada memori data jadwal untuk Anda' }, { status: 404 });
	} catch (error) {
		console.error('PUT Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal menyunting jadwal.' }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const { id } = await req.json();
		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Database tidak ditemukan' }, { status: 404 });

		const userId = req.headers.get('x-user-id');
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const rows = await sheet.getRows();
		const userRow = rows.find((r) => String(r.get('id_user')) === String(userId));

		if (userRow) {
			let jadwalArray = [];
			try {
				jadwalArray = JSON.parse(userRow.get('jadwal_data') || '[]');
			} catch (e) {}

			const initialLength = jadwalArray.length;
			const filteredArray = jadwalArray.filter((item) => String(item.id) !== String(id));

			if (filteredArray.length !== initialLength) {
				userRow.set('jadwal_data', JSON.stringify(filteredArray));
				await userRow.save();
				return NextResponse.json({ success: true });
			} else {
				return NextResponse.json({ error: 'ID sesi tidak tertaut dengan data Anda.' }, { status: 404 });
			}
		}

		return NextResponse.json({ error: 'Tidak ada data terekam sebelumnya.' }, { status: 404 });
	} catch (error) {
		console.error('DELETE Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal mencabut jadwal.' }, { status: 500 });
	}
}
