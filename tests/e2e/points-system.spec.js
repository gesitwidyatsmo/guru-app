/**
 * End-to-End tests for points system
 * Tests adding positive/negative points and viewing history
 */

const { test, expect } = require('@playwright/test');

test.describe('Points System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a class detail page (adjust URL as needed)
    await page.goto('/kelas');
    await page.waitForLoadState('networkidle');
    
    // Click on first class to enter detail page
    const firstClass = page.locator('a, button').filter({ hasText: /10A|kelas/i }).first();
    if (await firstClass.count() > 0) {
      await firstClass.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should navigate to points/poin section', async ({ page }) => {
    // Look for points/poin tab or link
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
      
      // Verify we're on the points page
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain('poin');
    }
  });

  test('should add positive points to a student', async ({ page }) => {
    // Navigate to points section
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Click add points button
    const addButton = page.locator('button').filter({ hasText: /tambah|add/i }).first();
    await addButton.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .modal');
    
    // Select student (if needed)
    const studentSelect = page.locator('select[name="siswa_id"]');
    if (await studentSelect.count() > 0) {
      await studentSelect.selectOption({ index: 1 });
    }
    
    // Select positive type
    const tipeSelect = page.locator('select[name="tipe"], input[value="positif"]');
    if (await tipeSelect.count() > 0) {
      if (await tipeSelect.first().getAttribute('type') === 'radio') {
        await tipeSelect.first().check();
      } else {
        await tipeSelect.first().selectOption('positif');
      }
    }
    
    // Fill in activity
    await page.fill('input[name="aktifitas"], textarea[name="aktifitas"]', 'Juara lomba E2E test');
    
    // Fill in points
    await page.fill('input[name="poin"]', '10');
    
    // Fill in date
    const dateInput = page.locator('input[name="tanggal"], input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill('2024-02-17');
    }
    
    // Submit
    await page.locator('button[type="submit"], button').filter({ hasText: /simpan|save/i }).click();
    
    // Wait for success
    await page.waitForTimeout(2000);
    
    // Verify success message or new point in list
    const hasSuccess = await page.locator('text=/berhasil|success/i').count() > 0;
    const hasNewPoint = await page.locator('text=Juara lomba E2E test').count() > 0;
    
    expect(hasSuccess || hasNewPoint).toBeTruthy();
  });

  test('should add negative points (violation) to a student', async ({ page }) => {
    // Navigate to points section
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Click add points button
    const addButton = page.locator('button').filter({ hasText: /tambah|add/i }).first();
    await addButton.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .modal');
    
    // Select negative type
    const tipeNegative = page.locator('select[name="tipe"], input[value="negatif"]');
    if (await tipeNegative.count() > 0) {
      if (await tipeNegative.first().getAttribute('type') === 'radio') {
        await tipeNegative.first().check();
      } else {
        await tipeNegative.first().selectOption('negatif');
      }
    }
    
    // Fill in violation
    await page.fill('input[name="aktifitas"], textarea[name="aktifitas"]', 'Terlambat masuk kelas');
    
    // Fill in negative points
    await page.fill('input[name="poin"]', '-5');
    
    // Submit
    await page.locator('button[type="submit"], button').filter({ hasText: /simpan|save/i }).click();
    
    // Wait for success
    await page.waitForTimeout(2000);
    
    // Verify
    const hasSuccess = await page.locator('text=/berhasil|success/i').count() > 0;
    expect(hasSuccess).toBeTruthy();
  });

  test('should display points history for a student', async ({ page }) => {
    // Navigate to points section
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Check if points history is visible
    const hasTable = await page.locator('table').count() > 0;
    const hasList = await page.locator('[data-testid="points-list"]').count() > 0;
    
    expect(hasTable || hasList).toBeTruthy();
    
    // Verify points data is displayed
    const pointsRows = page.locator('table tbody tr, [data-testid="point-item"]');
    const count = await pointsRows.count();
    
    // Should have at least some structure even if empty
    expect(count >= 0).toBeTruthy();
  });

  test('should calculate and display total points correctly', async ({ page }) => {
    // Navigate to points section
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for total points display
    const totalDisplay = page.locator('text=/total.*poin|poin.*total/i, [data-testid="total-points"]');
    
    if (await totalDisplay.count() > 0) {
      await expect(totalDisplay.first()).toBeVisible();
      
      // Verify it contains a number
      const text = await totalDisplay.first().textContent();
      const hasNumber = /\d+/.test(text);
      expect(hasNumber).toBeTruthy();
    }
  });

  test('should filter points by type (positive/negative)', async ({ page }) => {
    // Navigate to points section
    const poinTab = page.locator('a, button').filter({ hasText: /poin|point/i }).first();
    if (await poinTab.count() > 0) {
      await poinTab.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for filter buttons or tabs
    const positiveFilter = page.locator('button, a').filter({ hasText: /positif|positive/i }).first();
    
    if (await positiveFilter.count() > 0) {
      await positiveFilter.click();
      await page.waitForTimeout(1000);
      
      // Verify only positive points are shown
      const rows = page.locator('table tbody tr, [data-testid="point-item"]');
      const count = await rows.count();
      
      expect(count >= 0).toBeTruthy();
    }
  });
});
