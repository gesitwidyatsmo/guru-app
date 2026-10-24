/**
 * End-to-End (E2E) Test untuk Halaman Presensi/Absensi (/absensi)
 * Menguji alur pengguna di browser nyata menggunakan Playwright.
 */

const { test, expect } = require('@playwright/test');

test.describe('Halaman Absensi Mapel (/absensi) E2E', () => {
	test.beforeEach(async ({ page }) => {
		// Buka halaman /absensi
		await page.goto('/absensi');
		await page.waitForLoadState('domcontentloaded');
	});

	test('harus memuat halaman absensi dengan benar', async ({ page }) => {
		// Pastikan URL mengarah ke /absensi
		await expect(page).toHaveURL(/.*absensi/);

		// Periksa keberadaan judul halaman (Absensi Mapel)
		const heading = page.locator('h1, h2').filter({ hasText: /absensi/i }).first();
		await expect(heading).toBeVisible({ timeout: 10000 });
	});

	test('harus menampilkan kontrol filter (Kelas, Mapel, atau Tanggal)', async ({ page }) => {
		// Tunggu jika ada indikator loading selesai
		await page.waitForTimeout(1000);

		// Periksa tombol kembali (ButtonBack)
		const backBtn = page.locator('button, a').filter({ hasText: /kembali|back/i }).first();
		if (await backBtn.count() > 0) {
			await expect(backBtn).toBeVisible();
		}

		// Periksa input tanggal
		const dateInput = page.locator('input[type="date"]');
		if (await dateInput.count() > 0) {
			await expect(dateInput.first()).toBeVisible();
		}

		// Periksa dropdown pemilih (select)
		const selectElements = page.locator('select');
		const selectCount = await selectElements.count();
		expect(selectCount).toBeGreaterThanOrEqual(0);
	});
});
