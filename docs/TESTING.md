# Testing Guide for Guru-App

Panduan lengkap untuk menjalankan dan menulis tests pada aplikasi Guru-App.

## 📋 Daftar Isi

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

---

## Overview

Aplikasi Guru-App menggunakan strategi testing komprehensif yang mencakup:

### 1. **Unit Testing**
- **Framework**: Jest + React Testing Library
- **Scope**: Fungsi individual, API routes, komponen React
- **Lokasi**: `src/**/__tests__/`

### 2. **Integration Testing**
- **Framework**: Jest
- **Scope**: Alur data lengkap antar komponen dan API
- **Lokasi**: `src/__tests__/integration/`

### 3. **End-to-End (E2E) Testing**
- **Framework**: Playwright
- **Scope**: Workflow pengguna lengkap melalui browser
- **Lokasi**: `tests/e2e/`

---

## Setup

### Prerequisites

Pastikan Anda sudah menginstall dependencies:

```bash
npm install
```

### Install Playwright Browsers (Untuk E2E Tests)

Hanya perlu dilakukan sekali:

```bash
npm run playwright:install
```

Atau:

```bash
npx playwright install
```

---

## Running Tests

### Unit & Integration Tests

```bash
# Run semua unit dan integration tests
npm test

# Run tests dalam watch mode (untuk development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run semua E2E tests (headless mode)
npm run test:e2e

# Run E2E tests dengan UI interaktif
npm run test:e2e:ui

# Run E2E tests dengan browser visible (headed mode)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e tests/e2e/student-management.spec.js
```

### Run All Tests

```bash
# Run semua tests (unit + integration + E2E)
npm run test:all
```

---

## Writing Tests

### Unit Tests

#### API Route Tests

Contoh test untuk API route:

```javascript
import { GET, POST } from '@/app/api/siswa/route';
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';

jest.mock('@/lib/sheets', () => ({
  getSheet: jest.fn(),
}));

describe('/api/siswa', () => {
  beforeEach(async () => {
    const mockDoc = await mockGetSheet();
    getSheet.mockResolvedValue(mockDoc);
  });

  it('should return all students', async () => {
    const req = new Request('http://localhost:3000/api/siswa');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});
```

#### Component Tests

Contoh test untuk React component:

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/app/components/Modal';

describe('Modal Component', () => {
  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test">
        Content
      </Modal>
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Integration Tests

Contoh integration test:

```javascript
import { GET as getStudents, POST as createStudent } from '@/app/api/siswa/route';

describe('Student Management Flow', () => {
  it('should create and retrieve student', async () => {
    // 1. Create student
    const createReq = new Request('http://localhost:3000/api/siswa', {
      method: 'POST',
      body: JSON.stringify({ nama_lengkap: 'Test', kelas: '10A' }),
    });
    await createStudent(createReq);

    // 2. Retrieve students
    const getReq = new Request('http://localhost:3000/api/siswa');
    const response = await getStudents(getReq);
    const students = await response.json();

    expect(students.some(s => s.nama_lengkap === 'Test')).toBe(true);
  });
});
```

### E2E Tests

Contoh E2E test dengan Playwright:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Student Management', () => {
  test('should add new student', async ({ page }) => {
    await page.goto('/siswa');
    
    // Click add button
    await page.click('button:has-text("Tambah")');
    
    // Fill form
    await page.fill('input[name="nama_lengkap"]', 'E2E Student');
    await page.fill('input[name="kelas"]', '10A');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify
    await expect(page.locator('text=E2E Student')).toBeVisible();
  });
});
```

---

## Test Coverage

### Viewing Coverage Reports

Setelah menjalankan `npm run test:coverage`, buka:

```
coverage/lcov-report/index.html
```

### Coverage Thresholds

Target coverage minimum:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Files yang Dikecualikan dari Coverage

- `*.d.ts` - Type definitions
- `*.stories.*` - Storybook files
- `layout.js` - Next.js layout
- `globals.css` - CSS files

---

## Test Structure

### Directory Structure

```
guru-app/
├── src/
│   ├── __tests__/
│   │   ├── utils/
│   │   │   ├── mock-sheets.js      # Mock Google Sheets API
│   │   │   └── test-helpers.js     # Test utilities
│   │   └── integration/
│   │       ├── student-flow.test.js
│   │       └── points-flow.test.js
│   ├── app/
│   │   ├── api/
│   │   │   ├── poin/
│   │   │   │   ├── __tests__/
│   │   │   │   │   └── route.test.js
│   │   │   │   └── route.js
│   │   │   └── siswa/
│   │   │       ├── __tests__/
│   │   │       │   └── route.test.js
│   │   │       └── route.js
│   │   └── components/
│   │       ├── __tests__/
│   │       │   └── Modal.test.jsx
│   │       └── Modal.jsx
│   └── lib/
│       ├── __tests__/
│       │   └── sheets.test.js
│       └── sheets.js
├── tests/
│   └── e2e/
│       ├── student-management.spec.js
│       ├── points-system.spec.js
│       ├── grading-report.spec.js
│       └── navigation.spec.js
├── jest.config.js
├── jest.setup.js
└── playwright.config.js
```

---

## Mocking Google Sheets API

Karena aplikasi menggunakan Google Sheets sebagai backend, semua tests menggunakan mock implementation.

### Menggunakan Mock Sheets

```javascript
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';

const mockDoc = await mockGetSheet();
// mockDoc sudah memiliki MASTER_SISWA, MASTER_POIN, dll.
```

### Menambah Data Test

```javascript
const sheet = mockDoc.sheetsByTitle['MASTER_SISWA'];
await sheet.addRow({
  id: 'SIS-1',
  nama_lengkap: 'Test Student',
  kelas: '10A',
});
```

---

## Best Practices

### 1. **Test Isolation**
- Setiap test harus independen
- Gunakan `beforeEach` untuk setup
- Gunakan `afterEach` untuk cleanup

### 2. **Descriptive Test Names**
```javascript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should return all students when no filters applied', () => { ... });
```

### 3. **Arrange-Act-Assert Pattern**
```javascript
it('should create student', async () => {
  // Arrange
  const newStudent = { nama_lengkap: 'Test', kelas: '10A' };
  
  // Act
  const response = await createStudent(newStudent);
  
  // Assert
  expect(response.status).toBe(200);
});
```

### 4. **Test Edge Cases**
- Empty data
- Invalid inputs
- Error conditions
- Boundary values

### 5. **Keep Tests Fast**
- Unit tests: < 100ms each
- Integration tests: < 1s each
- E2E tests: dapat lebih lambat

### 6. **Don't Test Implementation Details**
```javascript
// ❌ Bad - testing internal state
expect(component.state.isOpen).toBe(true);

// ✅ Good - testing user-visible behavior
expect(screen.getByRole('dialog')).toBeVisible();
```

---

## Debugging Tests

### Jest Tests

```bash
# Run specific test file
npm test -- src/app/api/poin/__tests__/route.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create"

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Tests

```bash
# Run with debug mode
npx playwright test --debug

# Run specific test
npx playwright test tests/e2e/student-management.spec.js

# Show test report
npx playwright show-report
```

---

## CI/CD Integration

### GitHub Actions (Coming Soon)

File `.github/workflows/test.yml` akan menjalankan:

1. Unit tests
2. Integration tests
3. E2E tests
4. Coverage report
5. Fail jika coverage < threshold

### Running Tests in CI

```bash
# Set environment variables
export CI=true

# Run all tests
npm run test:all
```

---

## Troubleshooting

### Common Issues

#### 1. **Tests timeout**
```javascript
// Increase timeout for specific test
it('slow test', async () => {
  // ...
}, 10000); // 10 seconds
```

#### 2. **Mock not working**
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### 3. **Playwright browser not found**
```bash
npx playwright install
```

#### 4. **Environment variables not loaded**
Pastikan `.env.test.local` ada atau gunakan mock values di `jest.setup.js`.

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Support

Jika ada pertanyaan atau masalah dengan tests, silakan:

1. Check dokumentasi ini
2. Lihat contoh tests yang sudah ada
3. Buka issue di repository

---

**Happy Testing! 🧪**
