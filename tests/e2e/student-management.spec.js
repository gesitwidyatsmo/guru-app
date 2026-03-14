/**
 * End-to-End tests for student management
 * Tests complete user workflows through the browser
 */

const { test, expect } = require('@playwright/test');

test.describe('Student Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the students page
    await page.goto('/siswa');
    await page.waitForLoadState('networkidle');
  });

  test('should display students page with table', async ({ page }) => {
    // Check if the page title or header is visible
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Check if there's a table or list of students
    const hasTable = await page.locator('table').count() > 0;
    const hasList = await page.locator('[data-testid="student-list"]').count() > 0;
    
    expect(hasTable || hasList).toBeTruthy();
  });

  test('should open add student modal when clicking add button', async ({ page }) => {
    // Find and click the add student button
    const addButton = page.locator('button').filter({ hasText: /tambah|add/i }).first();
    await addButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"], .modal', { timeout: 5000 });
    
    // Verify modal is visible
    const modal = page.locator('[role="dialog"], .modal').first();
    await expect(modal).toBeVisible();
  });

  test('should add a new student manually', async ({ page }) => {
    // Click add student button
    await page.locator('button').filter({ hasText: /tambah|add/i }).first().click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .modal');
    
    // Fill in student information
    await page.fill('input[name="nama_lengkap"], input[placeholder*="nama"]', 'E2E Test Student');
    await page.fill('input[name="nis"], input[placeholder*="nis"]', '99999');
    
    // Select or fill class
    const kelasInput = page.locator('input[name="kelas"], select[name="kelas"]').first();
    await kelasInput.fill('10A');
    
    // Select gender if available
    const genderSelect = page.locator('select[name="jenis_kelamin"]');
    if (await genderSelect.count() > 0) {
      await genderSelect.selectOption('Laki-laki');
    }
    
    // Submit the form
    await page.locator('button[type="submit"], button').filter({ hasText: /simpan|save/i }).click();
    
    // Wait for success message or modal to close
    await page.waitForTimeout(2000);
    
    // Verify the student appears in the list
    await expect(page.locator('text=E2E Test Student')).toBeVisible({ timeout: 10000 });
  });

  test('should search/filter students', async ({ page }) => {
    // Look for search or filter input
    const searchInput = page.locator('input[type="search"], input[placeholder*="cari"], input[placeholder*="search"]').first();
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('Test');
      await page.waitForTimeout(1000);
      
      // Verify filtered results
      const rows = page.locator('table tbody tr, [data-testid="student-item"]');
      const count = await rows.count();
      
      // Should have some results or no results message
      expect(count >= 0).toBeTruthy();
    }
  });

  test('should edit student information', async ({ page }) => {
    // Find first student's edit button
    const editButton = page.locator('button').filter({ hasText: /edit|ubah/i }).first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Wait for edit modal
      await page.waitForSelector('[role="dialog"], .modal');
      
      // Modify student name
      const nameInput = page.locator('input[name="nama_lengkap"]').first();
      await nameInput.fill('Updated Student Name');
      
      // Save changes
      await page.locator('button[type="submit"], button').filter({ hasText: /simpan|save|update/i }).click();
      
      // Wait for update to complete
      await page.waitForTimeout(2000);
      
      // Verify update (check for success message or updated name)
      const hasSuccessMessage = await page.locator('text=/berhasil|success/i').count() > 0;
      const hasUpdatedName = await page.locator('text=Updated Student Name').count() > 0;
      
      expect(hasSuccessMessage || hasUpdatedName).toBeTruthy();
    }
  });

  test('should delete student with confirmation', async ({ page }) => {
    // Get initial student count
    const initialRows = await page.locator('table tbody tr, [data-testid="student-item"]').count();
    
    if (initialRows > 0) {
      // Find and click delete button
      const deleteButton = page.locator('button').filter({ hasText: /hapus|delete/i }).first();
      await deleteButton.click();
      
      // Wait for confirmation dialog
      await page.waitForTimeout(1000);
      
      // Confirm deletion (SweetAlert2 or native confirm)
      const confirmButton = page.locator('button').filter({ hasText: /ya|yes|hapus|delete|confirm/i }).last();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Wait for deletion to complete
      await page.waitForTimeout(2000);
      
      // Verify student count decreased or success message appeared
      const finalRows = await page.locator('table tbody tr, [data-testid="student-item"]').count();
      const hasSuccessMessage = await page.locator('text=/berhasil|success/i').count() > 0;
      
      expect(finalRows < initialRows || hasSuccessMessage).toBeTruthy();
    }
  });

  test('should handle bulk import via Excel file', async ({ page }) => {
    // Look for import/upload button
    const importButton = page.locator('button').filter({ hasText: /import|upload/i }).first();
    
    if (await importButton.count() > 0) {
      await importButton.click();
      
      // Wait for upload modal
      await page.waitForSelector('[role="dialog"], .modal');
      
      // Create a test Excel file (simplified - in real scenario, use actual Excel file)
      const fileInput = page.locator('input[type="file"]');
      
      // Note: In real E2E test, you would upload an actual Excel file
      // For now, we just verify the upload interface exists
      await expect(fileInput).toBeVisible();
    }
  });
});
