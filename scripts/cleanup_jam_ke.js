require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { normalizeJamKe } = require('../src/lib/absensiUtils');

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

const standardRegex = /^[1-9](-[1-9])?$/;

async function runCleanup() {
	console.log('🚀 Memulai Pembersihan Jam Ke Tidak Baku...');

	// 1. Bersihkan absensi_mapel
	const { data: aData, error: aErr } = await supabase.from('absensi_mapel').select('sesi_id, jam_ke');
	if (aErr) throw aErr;

	const aNonStd = (aData || []).filter((r) => !standardRegex.test(r.jam_ke?.trim()));
	console.log(`Ditemukan ${aNonStd.length} baris di absensi_mapel untuk dinormalisasi.`);

	for (const row of aNonStd) {
		const cleanJam = normalizeJamKe(row.jam_ke);
		if (cleanJam && cleanJam !== row.jam_ke) {
			const { error: updErr } = await supabase
				.from('absensi_mapel')
				.update({ jam_ke: cleanJam })
				.eq('sesi_id', row.sesi_id);
			if (updErr) {
				console.error(`Gagal update sesi ${row.sesi_id}:`, updErr.message);
			} else {
				console.log(`✅ [absensi_mapel] ${row.sesi_id}: "${row.jam_ke}" -> "${cleanJam}"`);
			}
		}
	}

	// 2. Bersihkan jurnal
	const { data: jData, error: jErr } = await supabase.from('jurnal').select('id, jam_ke');
	if (jErr) throw jErr;

	const jNonStd = (jData || []).filter((r) => !standardRegex.test(r.jam_ke?.trim()));
	console.log(`Ditemukan ${jNonStd.length} baris di jurnal untuk dinormalisasi.`);

	for (const row of jNonStd) {
		const cleanJam = row.jam_ke === 'Ekologi sosial' ? '6-7' : normalizeJamKe(row.jam_ke);
		if (cleanJam && cleanJam !== row.jam_ke) {
			const { error: updErr } = await supabase
				.from('jurnal')
				.update({ jam_ke: cleanJam })
				.eq('id', row.id);
			if (updErr) {
				console.error(`Gagal update jurnal ${row.id}:`, updErr.message);
			} else {
				console.log(`✅ [jurnal] ${row.id}: "${row.jam_ke}" -> "${cleanJam}"`);
			}
		}
	}

	console.log('🎉 Pembersihan Jam Ke selesai!');
}

runCleanup().catch(console.error);
