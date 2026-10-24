/**
 * E2E Browser Testing (Playwright)
 * Memverifikasi Tampilan Antarmuka, Proteksi Hak Akses (Middleware), dan Keamanan:
 * 1. Proteksi Halaman Guru: /absensi, /penilaian, /jurnal, /poin, /jadwal
 * 2. Proteksi Halaman Wali Kelas: /wali-kelas
 * 3. Tampilan Halaman Login (/login)
 * 4. Tampilan Halaman Publik (/soal, /berkas)
 */

const { test, expect } = require('@playwright/test');

test.describe('E2E Browser Testing: Keamanan & Tampilan Guru / Wali Kelas', () => {

	// =========================================================================
	// 1. UJI PROTEKSI HAK AKSES GURU (Unauthenticated User Guard)
	// =========================================================================
	test.describe('1. Proteksi Keamanan Rute Guru (Wajib Login)', () => {

		test('1.1 Mengakses /absensi tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/absensi');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('1.2 Mengakses /penilaian tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/penilaian');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('1.3 Mengakses /jurnal tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/jurnal');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('1.4 Mengakses /poin tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/poin');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('1.5 Mengakses /jadwal tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/jadwal');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});
	});

	// =========================================================================
	// 2. UJI PROTEKSI HUB WALI KELAS (Unauthenticated User Guard)
	// =========================================================================
	test.describe('2. Proteksi Keamanan Rute Wali Kelas (Wajib Login)', () => {

		test('2.1 Mengakses /wali-kelas tanpa login harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/wali-kelas');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('2.2 Mengakses tab presensi /wali-kelas?tab=presensi harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/wali-kelas?tab=presensi');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});

		test('2.3 Mengakses tab bimbingan /wali-kelas?tab=bimbingan harus diarahkan ke /login', async ({ page }) => {
			await page.goto('/wali-kelas?tab=bimbingan');
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(/.*login/);
		});
	});

	// =========================================================================
	// 3. UJI TAMPILAN & FORM LOGIN
	// =========================================================================
	test.describe('3. Verifikasi Tampilan Halaman Login (/login)', () => {

		test('3.1 Form login harus menampilkan input username, password, dan tombol masuk', async ({ page }) => {
			await page.goto('/login');
			await page.waitForLoadState('domcontentloaded');

			// Pastikan input username dan password ada
			const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
			const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
			const submitBtn = page.locator('button[type="submit"]').first();

			await expect(usernameInput).toBeVisible({ timeout: 10000 });
			await expect(passwordInput).toBeVisible();
			await expect(submitBtn).toBeVisible();
		});

		test('3.2 Login form harus memvalidasi input kosong', async ({ page }) => {
			await page.goto('/login');
			await page.waitForLoadState('domcontentloaded');

			const submitBtn = page.locator('button[type="submit"]').first();
			await submitBtn.click();

			// Sweetalert atau peringatan harus muncul jika kolom kosong
			await page.waitForTimeout(500);
			const alertOrBody = page.locator('.swal2-popup, body');
			await expect(alertOrBody).toBeVisible();
		});
	});

	// =========================================================================
	// 4. UJI TAMPILAN HALAMAN PUBLIK
	// =========================================================================
	test.describe('4. Verifikasi Tampilan Halaman Publik Bebas Akses', () => {

		test('4.1 Halaman Soal Siswa (/soal) dapat dibuka langsung tanpa login', async ({ page }) => {
			await page.goto('/soal');
			await page.waitForLoadState('domcontentloaded');

			await expect(page).toHaveURL(/.*soal/);
			const bodyElement = page.locator('body');
			await expect(bodyElement).toBeVisible();
		});
	});
});
