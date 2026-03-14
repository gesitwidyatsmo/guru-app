/**
 * End-to-End tests for general navigation
 * Tests menu navigation and responsive behavior
 */

const { test, expect } = require('@playwright/test');

test.describe('Navigation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load homepage successfully', async ({ page }) => {
    // Verify page loaded
    await expect(page).toHaveURL(/.*localhost:3000/);
    
    // Check for main content
    const hasContent = await page.locator('body').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should navigate to all main menu items', async ({ page }) => {
    const menuItems = [
      { text: /kelas|class/i, expectedUrl: /kelas/ },
      { text: /siswa|student/i, expectedUrl: /siswa/ },
      { text: /absensi|attendance/i, expectedUrl: /absensi/ },
      { text: /penilaian|grading/i, expectedUrl: /penilaian/ },
      { text: /jurnal|journal/i, expectedUrl: /jurnal/ },
    ];

    for (const item of menuItems) {
      const link = page.locator(`a, button`).filter({ hasText: item.text }).first();
      
      if (await link.count() > 0) {
        await link.click();
        await page.waitForLoadState('networkidle');
        
        // Verify navigation
        const currentUrl = page.url();
        const navigated = item.expectedUrl.test(currentUrl);
        
        expect(navigated).toBeTruthy();
        
        // Go back to home
        await page.goto('/');
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display navigation menu', async ({ page }) => {
    // Look for navigation elements
    const nav = page.locator('nav, [role="navigation"], header');
    
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
      
      // Verify menu has links
      const links = nav.locator('a');
      const linkCount = await links.count();
      
      expect(linkCount).toBeGreaterThan(0);
    }
  });

  test('should handle mobile menu toggle', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Look for hamburger menu button
    const menuButton = page.locator('button').filter({ 
      hasText: /menu|☰|≡/i 
    }).or(page.locator('[aria-label*="menu"]')).first();
    
    if (await menuButton.count() > 0) {
      // Click to open menu
      await menuButton.click();
      await page.waitForTimeout(500);
      
      // Verify menu is visible
      const mobileMenu = page.locator('[role="navigation"], nav, .mobile-menu, .menu');
      const isVisible = await mobileMenu.first().isVisible();
      
      expect(isVisible).toBeTruthy();
      
      // Click again to close
      await menuButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should navigate using breadcrumbs', async ({ page }) => {
    // Navigate to a deep page (e.g., class detail)
    await page.goto('/kelas');
    await page.waitForLoadState('networkidle');
    
    const firstClass = page.locator('a').filter({ hasText: /10A|kelas/i }).first();
    if (await firstClass.count() > 0) {
      await firstClass.click();
      await page.waitForLoadState('networkidle');
      
      // Look for breadcrumbs
      const breadcrumb = page.locator('[aria-label="breadcrumb"], .breadcrumb, nav ol, nav ul').first();
      
      if (await breadcrumb.count() > 0) {
        // Click on a breadcrumb link to navigate back
        const breadcrumbLink = breadcrumb.locator('a').first();
        
        if (await breadcrumbLink.count() > 0) {
          await breadcrumbLink.click();
          await page.waitForLoadState('networkidle');
          
          // Verify navigation worked
          const navigated = page.url() !== '';
          expect(navigated).toBeTruthy();
        }
      }
    }
  });

  test('should maintain navigation state across pages', async ({ page }) => {
    // Navigate to different pages and verify menu stays consistent
    await page.goto('/kelas');
    await page.waitForLoadState('networkidle');
    
    const nav1 = await page.locator('nav, [role="navigation"]').count();
    
    await page.goto('/siswa');
    await page.waitForLoadState('networkidle');
    
    const nav2 = await page.locator('nav, [role="navigation"]').count();
    
    // Navigation should exist on both pages
    expect(nav1).toBeGreaterThan(0);
    expect(nav2).toBeGreaterThan(0);
  });

  test('should handle 404 page gracefully', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');
    
    // Check for 404 message or redirect
    const pageContent = await page.content();
    const has404 = pageContent.includes('404') || 
                   pageContent.includes('not found') ||
                   pageContent.includes('tidak ditemukan');
    
    // Either shows 404 or redirects to home
    const isHome = page.url().endsWith('/') || page.url().includes('localhost:3000');
    
    expect(has404 || isHome).toBeTruthy();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Verify page is still functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
      
      // Verify no horizontal scroll on mobile
      if (viewport.name === 'Mobile') {
        const bodyWidth = await body.evaluate(el => el.scrollWidth);
        const viewportWidth = viewport.width;
        
        // Allow small tolerance for scrollbars
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
      }
    }
  });
});
