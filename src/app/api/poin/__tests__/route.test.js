/**
 * Unit tests for /api/poin route
 * Tests GET, POST, PUT, DELETE operations for points system
 */

import { GET, POST, PUT, DELETE } from '@/app/api/poin/route';
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';
import { createMockPoint, createMockStudent, setupTest, cleanupTest } from '@/__tests__/utils/test-helpers';

// Mock the sheets module
jest.mock('@/lib/sheets', () => ({
  getSheet: jest.fn(),
}));

const { getSheet } = require('@/lib/sheets');

describe('/api/poin', () => {
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
      // Add test data
      const sheet = mockDoc.sheetsByTitle['MASTER_POIN'];
      await sheet.addRow(createMockPoint({
        id: 'POIN-1',
        siswa_id: 'SIS-1',
        tipe: 'positif',
        poin: 10,
      }));
      await sheet.addRow(createMockPoint({
        id: 'POIN-2',
        siswa_id: 'SIS-2',
        tipe: 'negatif',
        poin: -5,
      }));
    });

    it('should return all points when no filters applied', async () => {
      const req = new Request('http://localhost:3000/api/poin');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('siswa_id');
      expect(data[0]).toHaveProperty('poin');
    });

    it('should filter points by siswa_id', async () => {
      const req = new Request('http://localhost:3000/api/poin?siswa_id=SIS-1');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].siswa_id).toBe('SIS-1');
    });

    it('should filter points by tipe', async () => {
      const req = new Request('http://localhost:3000/api/poin?tipe=positif');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].tipe).toBe('positif');
    });

    it('should filter points by kelas', async () => {
      // Add students to MASTER_SISWA
      const siswaSheet = mockDoc.sheetsByTitle['MASTER_SISWA'];
      await siswaSheet.addRow(createMockStudent({ id: 'SIS-1', kelas: '10A' }));
      await siswaSheet.addRow(createMockStudent({ id: 'SIS-2', kelas: '10B' }));

      const req = new Request('http://localhost:3000/api/poin?kelas=10A');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].siswa_id).toBe('SIS-1');
    });

    it('should return empty array when sheet does not exist', async () => {
      delete mockDoc.sheetsByTitle['MASTER_POIN'];
      
      const req = new Request('http://localhost:3000/api/poin');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      getSheet.mockRejectedValue(new Error('Connection failed'));

      const req = new Request('http://localhost:3000/api/poin');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST', () => {
    it('should create a new point successfully', async () => {
      const newPoint = {
        siswa_id: 'SIS-1',
        tanggal: '2024-02-17',
        tipe: 'positif',
        kategori: 'Akademik',
        aktifitas: 'Juara lomba',
        poin: 10,
        keterangan: 'Juara 1 olimpiade',
      };

      const req = new Request('http://localhost:3000/api/poin', {
        method: 'POST',
        body: JSON.stringify(newPoint),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('id');
      expect(data.id).toMatch(/^POIN-/);
    });

    it('should validate required fields', async () => {
      const invalidPoint = {
        siswa_id: 'SIS-1',
        // Missing required fields
      };

      const req = new Request('http://localhost:3000/api/poin', {
        method: 'POST',
        body: JSON.stringify(invalidPoint),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('wajib');
    });

    it('should create sheet if it does not exist', async () => {
      delete mockDoc.sheetsByTitle['MASTER_POIN'];

      const newPoint = {
        siswa_id: 'SIS-1',
        tanggal: '2024-02-17',
        tipe: 'positif',
        aktifitas: 'Test',
        poin: 5,
      };

      const req = new Request('http://localhost:3000/api/poin', {
        method: 'POST',
        body: JSON.stringify(newPoint),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockDoc.sheetsByTitle['MASTER_POIN']).toBeDefined();
    });

    it('should handle errors during creation', async () => {
      getSheet.mockRejectedValue(new Error('Database error'));

      const req = new Request('http://localhost:3000/api/poin', {
        method: 'POST',
        body: JSON.stringify({ siswa_id: 'SIS-1', tanggal: '2024-02-17', tipe: 'positif', aktifitas: 'Test', poin: 5 }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('PUT', () => {
    beforeEach(async () => {
      const sheet = mockDoc.sheetsByTitle['MASTER_POIN'];
      await sheet.addRow(createMockPoint({
        id: 'POIN-1',
        siswa_id: 'SIS-1',
        poin: 10,
      }));
    });

    it('should update an existing point', async () => {
      const updates = {
        id: 'POIN-1',
        poin: 15,
        keterangan: 'Updated',
      };

      const req = new Request('http://localhost:3000/api/poin', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return error when ID is missing', async () => {
      const req = new Request('http://localhost:3000/api/poin', {
        method: 'PUT',
        body: JSON.stringify({ poin: 15 }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should return error when point not found', async () => {
      const req = new Request('http://localhost:3000/api/poin', {
        method: 'PUT',
        body: JSON.stringify({ id: 'NONEXISTENT', poin: 15 }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });

  describe('DELETE', () => {
    beforeEach(async () => {
      const sheet = mockDoc.sheetsByTitle['MASTER_POIN'];
      await sheet.addRow(createMockPoint({ id: 'POIN-1' }));
    });

    it('should delete an existing point', async () => {
      const req = new Request('http://localhost:3000/api/poin?id=POIN-1', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return error when ID is missing', async () => {
      const req = new Request('http://localhost:3000/api/poin', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should return error when point not found', async () => {
      const req = new Request('http://localhost:3000/api/poin?id=NONEXISTENT', {
        method: 'DELETE',
      });

      const response = await DELETE(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
    });
  });
});
