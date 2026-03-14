/**
 * Unit tests for /api/siswa route
 * Tests GET, POST, PUT, DELETE operations for student management
 */

import { GET, POST, PUT, DELETE } from '@/app/api/siswa/route';
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';
import { createMockStudent, setupTest, cleanupTest } from '@/__tests__/utils/test-helpers';

// Mock the sheets module
jest.mock('@/lib/sheets', () => ({
  getSheet: jest.fn(),
}));

// Mock XLSX
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

const { getSheet } = require('@/lib/sheets');
const XLSX = require('xlsx');

describe('/api/siswa', () => {
  let mockDoc;

  beforeEach(async () => {
    setupTest();
    mockDoc = await mockGetSheet();
    getSheet.mockResolvedValue(mockDoc);
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('GET', () => {
    beforeEach(async () => {
      const sheet = mockDoc.sheetsByTitle['MASTER_SISWA'];
      await sheet.addRow(createMockStudent({
        id: 'SIS-1',
        nama_lengkap: 'Student 1',
        kelas: '10A',
        status: 'Aktif',
      }));
      await sheet.addRow(createMockStudent({
        id: 'SIS-2',
        nama_lengkap: 'Student 2',
        kelas: '10B',
        status: 'Aktif',
      }));
      await sheet.addRow(createMockStudent({
        id: 'SIS-3',
        nama_lengkap: 'Student 3',
        kelas: '10A',
        status: 'Tidak Aktif',
      }));
    });

    it('should return all students when no filters applied', async () => {
      const req = new Request('http://localhost:3000/api/siswa');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('nama_lengkap');
      expect(data[0]).toHaveProperty('kelas');
    });

    it('should filter students by kelas', async () => {
      const req = new Request('http://localhost:3000/api/siswa?kelas=10A');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data.every(s => s.kelas === '10A')).toBe(true);
    });

    it('should filter students by status', async () => {
      const req = new Request('http://localhost:3000/api/siswa?status=Aktif');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data.every(s => s.status === 'Aktif')).toBe(true);
    });

    it('should return 404 when sheet does not exist', async () => {
      delete mockDoc.sheetsByTitle['MASTER_SISWA'];

      const req = new Request('http://localhost:3000/api/siswa');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });

    it('should handle errors gracefully', async () => {
      getSheet.mockRejectedValue(new Error('Connection failed'));

      const req = new Request('http://localhost:3000/api/siswa');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST - Manual Input', () => {
    it('should create a new student successfully', async () => {
      const newStudent = {
        nis: '12345',
        nama_lengkap: 'New Student',
        kelas: '10A',
        jenis_kelamin: 'Laki-laki',
        status: 'Aktif',
      };

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newStudent),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Berhasil');
    });

    it('should validate required fields', async () => {
      const invalidStudent = {
        nis: '12345',
        // Missing nama_lengkap and kelas
      };

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(invalidStudent),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('wajib');
    });

    it('should create sheet if it does not exist', async () => {
      delete mockDoc.sheetsByTitle['MASTER_SISWA'];

      const newStudent = {
        nama_lengkap: 'New Student',
        kelas: '10A',
      };

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newStudent),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDoc.sheetsByTitle['MASTER_SISWA']).toBeDefined();
    });
  });

  describe('POST - Bulk Import', () => {
    it('should import students from Excel file', async () => {
      const mockExcelData = [
        { 'NIS': '10001', 'Nama Lengkap': 'Student A', 'Jenis Kelamin': 'Laki-laki' },
        { 'NIS': '10002', 'Nama Lengkap': 'Student B', 'Jenis Kelamin': 'Perempuan' },
      ];

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      XLSX.utils.sheet_to_json.mockReturnValue(mockExcelData);

      const formData = new FormData();
      const file = new File(['dummy'], 'students.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('file', file);
      formData.append('kelas_target', '10A');

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total).toBe(2);
    });

    it('should return error when file is missing', async () => {
      const formData = new FormData();
      formData.append('kelas_target', '10A');

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('file');
    });

    it('should return error when kelas_target is missing', async () => {
      const formData = new FormData();
      const file = new File(['dummy'], 'students.xlsx');
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('kelas');
    });

    it('should handle empty Excel file', async () => {
      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      XLSX.utils.sheet_to_json.mockReturnValue([]);

      const formData = new FormData();
      const file = new File(['dummy'], 'students.xlsx');
      formData.append('file', file);
      formData.append('kelas_target', '10A');

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('kosong');
    });
  });

  describe('PUT', () => {
    beforeEach(async () => {
      const sheet = mockDoc.sheetsByTitle['MASTER_SISWA'];
      await sheet.addRow(createMockStudent({ id: 'SIS-1', nama_lengkap: 'Original Name' }));
    });

    it('should update an existing student', async () => {
      const updates = {
        id: 'SIS-1',
        nama_lengkap: 'Updated Name',
        kelas: '11A',
      };

      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('berhasil');
    });

    it('should return error when student not found', async () => {
      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'PUT',
        body: JSON.stringify({ id: 'NONEXISTENT', nama_lengkap: 'Test' }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  describe('DELETE', () => {
    beforeEach(async () => {
      const sheet = mockDoc.sheetsByTitle['MASTER_SISWA'];
      await sheet.addRow(createMockStudent({ id: 'SIS-1' }));
    });

    it('should delete an existing student', async () => {
      const req = new Request('http://localhost:3000/api/siswa?id=SIS-1', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('berhasil');
    });

    it('should return error when ID is missing', async () => {
      const req = new Request('http://localhost:3000/api/siswa', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should return error when student not found', async () => {
      const req = new Request('http://localhost:3000/api/siswa?id=NONEXISTENT', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });
});
