import { hitungTotalPoinBersih, konversiPoinKeSikap, konversiPoinKeBonus } from '../poinUtils';

describe('poinUtils', () => {
	describe('hitungTotalPoinBersih', () => {
		it('mengembalikan 0 untuk list kosong atau input null', () => {
			expect(hitungTotalPoinBersih([])).toBe(0);
			expect(hitungTotalPoinBersih(null)).toBe(0);
		});

		it('menghitung akumulasi poin positif dan negatif dengan benar', () => {
			const poinList = [
				{ tipe: 'positif', poin: 20 },
				{ tipe: 'positif', poin: 15 },
				{ tipe: 'negatif', poin: 10 },
				{ tipe: 'negatif', poin: '5' },
			];
			// 20 + 15 - 10 - 5 = 20
			expect(hitungTotalPoinBersih(poinList)).toBe(20);
		});

		it('mengabaikan poin dengan format tidak valid', () => {
			const poinList = [
				{ tipe: 'positif', poin: 'abc' },
				{ tipe: 'negatif', poin: 10 },
			];
			expect(hitungTotalPoinBersih(poinList)).toBe(-10);
		});
	});

	describe('konversiPoinKeSikap', () => {
		it('mengembalikan Predikat A (Sangat Baik) untuk poin >= 50', () => {
			const res = konversiPoinKeSikap(50);
			expect(res.predikat).toBe('A');
			expect(res.label).toBe('Sangat Baik');
		});

		it('mengembalikan Predikat B (Baik) untuk poin 10 s/d 49', () => {
			const res1 = konversiPoinKeSikap(10);
			expect(res1.predikat).toBe('B');
			expect(res1.label).toBe('Baik');

			const res2 = konversiPoinKeSikap(49);
			expect(res2.predikat).toBe('B');
		});

		it('mengembalikan Predikat C (Cukup) untuk poin -9 s/d 9', () => {
			const res1 = konversiPoinKeSikap(0);
			expect(res1.predikat).toBe('C');
			expect(res1.label).toBe('Cukup');

			const res2 = konversiPoinKeSikap(-9);
			expect(res2.predikat).toBe('C');

			const res3 = konversiPoinKeSikap(9);
			expect(res3.predikat).toBe('C');
		});

		it('mengembalikan Predikat D (Perlu Bimbingan) untuk poin <= -10', () => {
			const res = konversiPoinKeSikap(-10);
			expect(res.predikat).toBe('D');
			expect(res.label).toBe('Perlu Bimbingan');

			const res2 = konversiPoinKeSikap(-50);
			expect(res2.predikat).toBe('D');
		});
	});

	describe('konversiPoinKeBonus', () => {
		it('menghitung rasio bonus dengan pembatasan clamp', () => {
			// 30 poin / 10 = +3.0
			expect(konversiPoinKeBonus(30, 5, 10)).toBe(3);

			// 80 poin / 10 = 8, tapi clamp max 5
			expect(konversiPoinKeBonus(80, 5, 10)).toBe(5);

			// -70 poin / 10 = -7, clamp min -5
			expect(konversiPoinKeBonus(-70, 5, 10)).toBe(-5);
		});
	});
});
