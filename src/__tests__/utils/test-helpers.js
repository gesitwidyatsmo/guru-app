/**
 * Test helper utilities and data factories
 */

/**
 * Generate a unique ID for testing
 */
export const generateTestId = (prefix = 'TEST') => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

/**
 * Create mock student data
 */
export const createMockStudent = (overrides = {}) => {
  return {
    id: generateTestId('SIS'),
    nis: '12345',
    nama_lengkap: 'Test Student',
    kelas: '10A',
    jenis_kelamin: 'Laki-laki',
    status: 'Aktif',
    ...overrides,
  };
};

/**
 * Create multiple mock students
 */
export const createMockStudents = (count = 5, kelasName = '10A') => {
  return Array.from({ length: count }, (_, i) => 
    createMockStudent({
      nis: `${10000 + i}`,
      nama_lengkap: `Student ${i + 1}`,
      kelas: kelasName,
    })
  );
};

/**
 * Create mock point data
 */
export const createMockPoint = (overrides = {}) => {
  return {
    id: generateTestId('POIN'),
    siswa_id: generateTestId('SIS'),
    tanggal: new Date().toISOString().split('T')[0],
    tipe: 'positif',
    kategori: 'Akademik',
    aktifitas: 'Juara lomba',
    poin: 10,
    keterangan: 'Test point',
    ...overrides,
  };
};

/**
 * Create mock class data
 */
export const createMockClass = (overrides = {}) => {
  return {
    id: generateTestId('KELAS'),
    nama: '10A',
    tingkat: '10',
    tahun_ajaran: '2024/2025',
    ...overrides,
  };
};

/**
 * Create mock attendance data
 */
export const createMockAttendance = (overrides = {}) => {
  return {
    id: generateTestId('ABS'),
    siswa_id: generateTestId('SIS'),
    tanggal: new Date().toISOString().split('T')[0],
    status: 'Hadir',
    keterangan: '',
    ...overrides,
  };
};

/**
 * Wait for a specific time (useful for async operations)
 */
export const wait = (ms = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock fetch response
 */
export const mockFetchResponse = (data, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

/**
 * Mock successful API response
 */
export const mockSuccessResponse = (data = {}) => {
  return { success: true, ...data };
};

/**
 * Mock error API response
 */
export const mockErrorResponse = (message = 'Error occurred') => {
  return { error: message };
};

/**
 * Create mock Excel file data for testing bulk import
 */
export const createMockExcelData = (students) => {
  return students.map(s => ({
    'NIS': s.nis,
    'Nama Lengkap': s.nama_lengkap,
    'Jenis Kelamin': s.jenis_kelamin,
  }));
};

/**
 * Custom matchers for testing
 */
export const customMatchers = {
  toBeValidStudent(received) {
    const requiredFields = ['id', 'nama_lengkap', 'kelas'];
    const hasAllFields = requiredFields.every(field => field in received);
    
    return {
      pass: hasAllFields,
      message: () => 
        hasAllFields
          ? `Expected object not to be a valid student`
          : `Expected object to have all required fields: ${requiredFields.join(', ')}`,
    };
  },
  
  toBeValidPoint(received) {
    const requiredFields = ['id', 'siswa_id', 'tanggal', 'tipe', 'aktifitas', 'poin'];
    const hasAllFields = requiredFields.every(field => field in received);
    const validTipe = ['positif', 'negatif'].includes(received.tipe);
    
    return {
      pass: hasAllFields && validTipe,
      message: () => 
        hasAllFields && validTipe
          ? `Expected object not to be a valid point`
          : `Expected object to have all required fields and valid tipe`,
    };
  },
};

/**
 * Setup function to run before each test
 */
export const setupTest = () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset environment variables
  process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = 'test-private-key';
};

/**
 * Cleanup function to run after each test
 */
export const cleanupTest = () => {
  jest.restoreAllMocks();
};
