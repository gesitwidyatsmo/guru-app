/**
 * Helper & Utility Functions untuk Modul E-Rapor (Kurikulum Merdeka)
 * SMP IT Tebuireng 4 Al-Ishlah
 */

/**
 * Ekstrak tingkat kelas dari nama rombel (misal: "VII.A" -> 7, "VIII.B" -> 8, "IX.C" -> 9)
 * @param {string} namaKelas
 * @returns {number} Tingkat 7, 8, atau 9
 */
export function extractTingkat(namaKelas = '') {
	const clean = String(namaKelas || '').toUpperCase();
	if (clean.includes('VII') && !clean.includes('VIII')) return 7;
	if (clean.includes('VIII')) return 8;
	if (clean.includes('IX')) return 9;
	if (clean.includes('7')) return 7;
	if (clean.includes('8')) return 8;
	if (clean.includes('9')) return 9;
	return 7;
}

/**
 * Normalisasi dan bersihkan rumusan Tujuan Pembelajaran (TP) agar menyatu luwes
 * dengan kalimat capaian kompetensi rapor Kurikulum Merdeka.
 * 
 * Fungsi ini otomatis memangkas awalan klise RPP/Modul Ajar seperti:
 * "Siswa mampu...", "Peserta didik dapat...", "Mampu...", "Dapat...", dsb.,
 * serta memastikan huruf pertama diawali kata kerja operasional (huruf kecil).
 *
 * @param {string} text Deskripsi TP mentah
 * @returns {string} Deskripsi TP yang sudah dinormalisasi
 */
export function cleanTpDeskripsi(text = '') {
	if (!text) return '';
	let clean = String(text).trim();

	// 1. Hilangkan penomoran di awal jika ada (misal: "1. ", "a) ", "• ", "- ")
	clean = clean.replace(/^[0-9a-zA-Z]+[\.\)]\s*|^[•\-\*]\s*/, '');

	// 2. Hilangkan awalan subjek + predikat klise penulisan RPP/Modul Ajar
	const patterns = [
		/^(peserta\s+didik|siswa|santri|murid|ananda)\s+(mampu|dapat|bisa|terampil|memiliki\s+kemampuan\s+untuk)\s+/i,
		/^(peserta\s+didik|siswa|santri|murid|ananda)\s+/i,
		/^(mampu|dapat|bisa|terampil\s+dalam)\s+/i,
		/^(dalam\s+hal|dalam)\s+/i,
	];

	for (const pattern of patterns) {
		clean = clean.replace(pattern, '').trim();
	}

	// 3. Pastikan huruf pertama bukan kapital kecuali singkatan/istilah nama khusus
	if (clean.length > 0) {
		const firstWord = clean.split(' ')[0];
		const isSpecial =
			/^(al-|al\b|allah|qur|hadits|pabp|ipa|ips|mtk|ppkn|ti)/i.test(firstWord) ||
			(firstWord.length > 1 && firstWord === firstWord.toUpperCase());

		if (!isSpecial) {
			clean = clean.charAt(0).toLowerCase() + clean.slice(1);
		}
	}

	// 4. Hilangkan titik dan spasi berlebih di akhir agar rapi saat digabung
	clean = clean.replace(/[\.\s]+$/, '');

	return clean;
}

/**
 * Generator narasi capaian kompetensi Kurikulum Merdeka berdasarkan rubrik TP (skala 1-4)
 * @param {Array} tpList Daftar Tujuan Pembelajaran [{ id, deskripsi, kode_tp }]
 * @param {Object} scores Map skor TP siswa { [tpId]: number (1-4) }
 * @returns {{ deskripsi_tertinggi: string, deskripsi_terendah: string }}
 */
export function generateCapaianDeskripsi(tpList = [], scores = {}) {
	const tpsSangatBaik = [];
	const tpsBaik = [];
	const tpsCukup = [];
	const tpsPerluBimbingan = [];

	tpList.forEach((tp) => {
		const val = scores[tp.id];
		const cleanedDesc = cleanTpDeskripsi(tp.deskripsi);
		if (!cleanedDesc) return;

		if (val === 4) tpsSangatBaik.push(cleanedDesc);
		else if (val === 3) tpsBaik.push(cleanedDesc);
		else if (val === 2) tpsCukup.push(cleanedDesc);
		else if (val === 1) tpsPerluBimbingan.push(cleanedDesc);
	});

	let tertinggi = '';
	let terendah = '';

	if (tpsSangatBaik.length > 0) {
		tertinggi += `Menunjukkan penguasaan sangat baik dalam ${tpsSangatBaik.join(', ')}. `;
	}
	if (tpsBaik.length > 0) {
		tertinggi += `Menunjukkan penguasaan baik dalam ${tpsBaik.join(', ')}. `;
	}

	if (tpsCukup.length > 0) {
		terendah += `Cukup mampu dalam ${tpsCukup.join(', ')}. `;
	}
	if (tpsPerluBimbingan.length > 0) {
		terendah += `Perlu bimbingan lebih lanjut dalam ${tpsPerluBimbingan.join(', ')}. `;
	}

	return {
		deskripsi_tertinggi: tertinggi.trim(),
		deskripsi_terendah: terendah.trim(),
	};
}

/**
 * Cek apakah kelas/rombel dalam status terkunci (Read-Only) baik secara Global (Kurikulum)
 * maupun oleh Wali Kelas di Leger Nilai.
 * @param {object} supabase Client Supabase terotentikasi
 * @param {{ kelasId?: string, kelas_id?: string, tahunAjaran?: string, tahun_ajaran?: string, semester: number|string }} params
 * @returns {Promise<{ isLocked: boolean, isGlobal: boolean, lockedByName: string }>}
 */
export async function checkClassLock(supabase, { kelasId, kelas_id, tahunAjaran, tahun_ajaran, semester }) {
	const sem = parseInt(semester || '1', 10);
	const ta = tahunAjaran || tahun_ajaran || '2026/2027';
	const targetKelasId = kelasId || kelas_id;

	// 1. Cek kunci global Kurikulum
	try {
		const { data: setRapor } = await supabase
			.from('rapor_pengaturan')
			.select('is_locked_global')
			.limit(1)
			.maybeSingle();
		if (setRapor?.is_locked_global) {
			return { isLocked: true, isGlobal: true, lockedByName: 'Kurikulum (Global)' };
		}
	} catch (e) {
		// fallback
	}

	try {
		const { data: appSet } = await supabase
			.from('app_settings')
			.select('value')
			.eq('key', 'rapor_settings')
			.maybeSingle();
		if (appSet?.value?.is_locked_global) {
			return { isLocked: true, isGlobal: true, lockedByName: 'Kurikulum (Global)' };
		}
	} catch (e) {
		// fallback
	}

	// 2. Cek kunci rombel tingkat Wali Kelas
	if (targetKelasId) {
		try {
			const { data: dbLock } = await supabase
				.from('rapor_status_kelas')
				.select('is_locked_wali, locked_by:locked_by_wali(nama_lengkap)')
				.eq('id_kelas', targetKelasId)
				.eq('tahun_ajaran', ta)
				.eq('semester', sem)
				.maybeSingle();

			if (dbLock?.is_locked_wali) {
				return {
					isLocked: true,
					isGlobal: false,
					lockedByName: dbLock.locked_by?.nama_lengkap || 'Wali Kelas',
				};
			}
		} catch (e) {
			// fallback
		}

		try {
			const key = `rapor_locks_${ta}_${sem}`;
			const { data: appLocks } = await supabase
				.from('app_settings')
				.select('value')
				.eq('key', key)
				.maybeSingle();
			if (appLocks?.value?.[targetKelasId]?.is_locked_wali) {
				return {
					isLocked: true,
					isGlobal: false,
					lockedByName: appLocks.value[targetKelasId].locked_by_name || 'Wali Kelas',
				};
			}
		} catch (e) {
			// fallback
		}
	}

	return { isLocked: false, isGlobal: false, lockedByName: '' };
}
