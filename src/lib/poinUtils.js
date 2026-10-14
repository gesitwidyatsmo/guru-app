/**
 * Utilitas Kalkulasi & Konversi Sistem Poin Guru App
 * Digunakan untuk mengintegrasikan akumulasi poin perilaku dengan nilai sikap raport.
 */

/**
 * Menghitung total poin bersih (net points) dari daftar poin seorang siswa
 * @param {Array<{ tipe: string, poin: number|string }>} poinList
 * @returns {number} Poin bersih (positif - negatif)
 */
export function hitungTotalPoinBersih(poinList = []) {
	if (!Array.isArray(poinList) || poinList.length === 0) return 0;
	return poinList.reduce((acc, item) => {
		const val = parseInt(item.poin || 0, 10);
		if (Number.isNaN(val)) return acc;
		return item.tipe === 'positif' ? acc + val : acc - val;
	}, 0);
}

/**
 * Mengonversi total poin bersih menjadi predikat nilai sikap sesuai standar K13 / Kurikulum Merdeka
 * @param {number} totalPoinBersih
 * @returns {{
 *   predikat: 'A' | 'B' | 'C' | 'D',
 *   label: string,
 *   warna: string,
 *   badgeColor: string,
 *   badgeClass: string
 * }}
 */
export function konversiPoinKeSikap(totalPoinBersih = 0) {
	const poin = typeof totalPoinBersih === 'number' ? totalPoinBersih : parseInt(totalPoinBersih || 0, 10);

	if (poin >= 50) {
		return {
			predikat: 'A',
			label: 'Sangat Baik',
			warna: 'emerald',
			badgeColor: '#10B981',
			badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
		};
	}

	if (poin >= 10) {
		return {
			predikat: 'B',
			label: 'Baik',
			warna: 'blue',
			badgeColor: '#3B82F6',
			badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
		};
	}

	if (poin >= -9) {
		return {
			predikat: 'C',
			label: 'Cukup',
			warna: 'amber',
			badgeColor: '#F59E0B',
			badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
		};
	}

	return {
		predikat: 'D',
		label: 'Perlu Bimbingan',
		warna: 'rose',
		badgeColor: '#EF4444',
		badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
	};
}

/**
 * Konversi poin ke bonus/penalti nilai akademik langsung (untuk Opsi C masa depan)
 * @param {number} totalPoinBersih
 * @param {number} maxBonus - Maksimum nilai bonus/penalti (default: 5)
 * @param {number} rasio - Berapa poin setara 1 nilai (default: 10)
 * @returns {number}
 */
export function konversiPoinKeBonus(totalPoinBersih = 0, maxBonus = 5, rasio = 10) {
	if (!totalPoinBersih || rasio <= 0) return 0;
	const raw = totalPoinBersih / rasio;
	const clamped = Math.max(-maxBonus, Math.min(maxBonus, raw));
	return parseFloat(clamped.toFixed(1));
}
