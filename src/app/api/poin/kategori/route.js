import { getSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';

// =====================
// GET - Ambil Kategori Poin (Positif & Negatif)
// =====================
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const tipe = searchParams.get('tipe'); // 'positif' atau 'negatif'

		const doc = await getSheet();

		let result = { positif: [], negatif: [], badges: [] };

		// Ambil kategori positif
		const sheetPositif = doc.sheetsByTitle['daftar_kategori_positif'];
		if (sheetPositif) {
			const rows = await sheetPositif.getRows();
			result.positif = rows.map((row) => ({
				id: row.get('id'),
				kategori_kode: row.get('kategori_kode'),
				kategori: row.get('kategori'),
				aktivitas: row.get('aktivitas'),
				bobot_default: parseInt(row.get('bobot_default') || '0', 10),
				deskripsi: row.get('deskripsi'),
				icon: row.get('icon'),
			}));
		}

		// Ambil kategori negatif
		const sheetNegatif = doc.sheetsByTitle['daftar_kategori_minus'];
		if (sheetNegatif) {
			const rows = await sheetNegatif.getRows();
			result.negatif = rows.map((row) => ({
				id: row.get('id'),
				kategori_kode: row.get('kategori_kode'),
				kategori: row.get('kategori'),
				aktivitas: row.get('aktivitas'),
				bobot_default: parseInt(row.get('bobot_default') || '0', 10),
				tingkat: row.get('tingkat'),
				deskripsi: row.get('deskripsi'),
				icon: row.get('icon'),
			}));
		}

		// Ambil badges
		const sheetBadges = doc.sheetsByTitle['badge_poin'];
		if (sheetBadges) {
			const rows = await sheetBadges.getRows();
			result.badges = rows.map((row) => ({
				id: row.get('id'),
				badge_kode: row.get('badge_kode'),
				badge_nama: row.get('badge_nama'),
				badge_emoji: row.get('badge_emoji'),
				kategori: row.get('kategori'),
				deskripsi: row.get('deskripsi'),
				syarat: row.get('syarat'),
			}));
		}

		// Filter by tipe jika diminta
		if (tipe === 'positif') {
			return NextResponse.json(result.positif);
		} else if (tipe === 'negatif') {
			return NextResponse.json(result.negatif);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error('❌ Error GET kategori poin:', error);
		return NextResponse.json({ error: 'Gagal mengambil data kategori' }, { status: 500 });
	}
}
