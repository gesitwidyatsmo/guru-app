import { NextResponse } from 'next/server';
import { getSheet, getOrCreateSheet } from '@/lib/sheets';

// Headers untuk sheet Data_Tugas
const TUGAS_HEADERS = ['ID', 'PIN', 'Judul', 'Mapel', 'Materi', 'Tipe_Soal', 'Soal', 'CreatedAt', 'CreatedBy'];

// Helper to check Auth from Headers
const getAuthData = (request) => {
	const role = request.headers.get('x-user-role');
	const id = request.headers.get('x-user-id');
	const name = request.headers.get('x-user-name');
	if (!role || !id) return null;
	return { role, id, name: decodeURIComponent(name || '') };
};

export async function GET(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const doc = await getSheet();
		const sheet = await getOrCreateSheet(doc, 'Data_Tugas', TUGAS_HEADERS);
		const rows = await sheet.getRows();

		const tasks = rows.map((row) => ({
			id: row.get('ID'),
			pin: row.get('PIN'),
			judul: row.get('Judul'),
			mapel: row.get('Mapel'),
			materi: row.get('Materi'),
			tipe_soal: row.get('Tipe_Soal'),
			soal: row.get('Soal'),
			createdAt: row.get('CreatedAt'),
			createdBy: row.get('CreatedBy'),
		}));

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (id) {
			const task = tasks.find((t) => t.id === id);
			if (!task) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
			return NextResponse.json(task);
		}

		return NextResponse.json(tasks.reverse());
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal mengambil data tugas' }, { status: 500 });
	}
}

export async function POST(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const { judul, mapel, materi, tipe_soal, soal } = body;

		if (!judul || !tipe_soal || !soal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const pin = Math.random().toString(36).substring(2, 8).toUpperCase();
		const newId = Date.now().toString();

		const doc = await getSheet();
		const sheet = await getOrCreateSheet(doc, 'Data_Tugas', TUGAS_HEADERS);

		const newRow = {
			ID: newId,
			PIN: pin,
			Judul: judul,
			Mapel: mapel || '',
			Materi: materi || '',
			Tipe_Soal: tipe_soal,
			Soal: JSON.stringify(soal),
			CreatedAt: new Date().toISOString(),
			CreatedBy: auth.name || auth.id,
		};

		await sheet.addRow(newRow);

		return NextResponse.json({ message: 'Tugas berhasil dibuat', pin });
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal membuat tugas' }, { status: 500 });
	}
}

export async function DELETE(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID tidak ditemukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = await getOrCreateSheet(doc, 'Data_Tugas', TUGAS_HEADERS);
		const rows = await sheet.getRows();

		const rowToDelete = rows.find((row) => row.get('ID') === id);
		if (!rowToDelete) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });

		await rowToDelete.delete();

		return NextResponse.json({ message: 'Tugas berhasil dihapus' });
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal menghapus tugas' }, { status: 500 });
	}
}

export async function PUT(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const { id, judul, mapel, materi, tipe_soal, soal } = body;

		if (!id || !judul || !tipe_soal || !soal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = await getOrCreateSheet(doc, 'Data_Tugas', TUGAS_HEADERS);
		const rows = await sheet.getRows();

		const rowToUpdate = rows.find((row) => row.get('ID') === id);
		if (!rowToUpdate) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });

		rowToUpdate.set('Judul', judul);
		rowToUpdate.set('Mapel', mapel || '');
		rowToUpdate.set('Materi', materi || '');
		rowToUpdate.set('Tipe_Soal', tipe_soal);
		rowToUpdate.set('Soal', JSON.stringify(soal));

		await rowToUpdate.save();

		return NextResponse.json({ message: 'Tugas berhasil diperbarui' });
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal memperbarui tugas' }, { status: 500 });
	}
}
