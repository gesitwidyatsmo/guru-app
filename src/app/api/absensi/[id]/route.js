import { getSheet } from '@/lib/sheets';

// ✅ PERBAIKAN: Await params di Next.js 13+
export async function PUT(req, context) {
	try {
		// Next.js 13+ memerlukan await untuk params
		const params = await context.params;
		const { id } = params;
		const body = await req.json();

		console.log('=== UPDATE ABSENSI ===');
		console.log('Params:', params);
		console.log('ID:', id);
		console.log('Body:', body);

		if (!id) {
			return Response.json({ error: 'ID tidak ditemukan' }, { status: 400 });
		}

		if (!body.status) {
			return Response.json({ error: 'Status wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_ABSENSI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		console.log('Total rows di sheet:', rows.length);

		// Normalisasi ID
		const normalizeId = (str) => {
			if (!str) return '';
			return String(str).trim().toLowerCase();
		};

		const searchId = normalizeId(id);
		console.log('Search ID:', searchId);

		// Cari row
		const row = rows.find((r) => {
			const rowId1 = normalizeId(r.get('id') || '');
			const rowId2 = normalizeId(r.id || '');

			if (rowId1 === searchId) {
				console.log('✅ Match via get(id)');
				return true;
			}
			if (rowId2 === searchId) {
				console.log('✅ Match via .id');
				return true;
			}

			return false;
		});

		if (!row) {
			console.error('❌ Row tidak ditemukan!');
			console.log(
				'Sample IDs:',
				rows.slice(0, 5).map((r) => ({
					get: r.get('id'),
					prop: r.id,
				})),
			);

			return Response.json(
				{
					error: 'Data absensi tidak ditemukan',
					searchId,
					sampleIds: rows.slice(0, 5).map((r) => r.get('id')),
				},
				{ status: 404 },
			);
		}

		console.log('✅ Row ditemukan!');

		// Update
		row.set('status', body.status);
		row.set('keterangan', body.keterangan || '');

		await row.save();

		console.log('✅ Update berhasil!');

		return Response.json(
			{
				success: true,
				data: {
					id: row.get('id'),
					status: row.get('status'),
					keterangan: row.get('keterangan'),
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('❌ Error PUT absensi:', error);
		return Response.json(
			{
				error: error?.message || 'Terjadi kesalahan server',
				stack: error?.stack,
			},
			{ status: 500 },
		);
	}
}
