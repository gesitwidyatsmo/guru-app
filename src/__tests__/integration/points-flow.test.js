/**
 * Integration tests for points system flow
 * Tests complete workflow: Add student → Add points → Calculate total → View history
 */

import { GET as getStudents, POST as createStudent } from '@/app/api/siswa/route';
import { GET as getPoints, POST as createPoint } from '@/app/api/poin/route';
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';
import { setupTest, cleanupTest } from '@/__tests__/utils/test-helpers';

jest.mock('@/lib/sheets', () => ({
  getSheet: jest.fn(),
}));

const { getSheet } = require('@/lib/sheets');

describe('Points System Integration Flow', () => {
  let mockDoc;
  let studentId;

  beforeEach(async () => {
    setupTest();
    mockDoc = await mockGetSheet();
    getSheet.mockResolvedValue(mockDoc);

    // Create a test student first
    const createStudentReq = new Request('http://localhost:3000/api/siswa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nama_lengkap: 'Points Test Student',
        kelas: '10A',
      }),
    });

    await createStudent(createStudentReq);

    // Get the student ID
    const getStudentsReq = new Request('http://localhost:3000/api/siswa?kelas=10A');
    const studentsResponse = await getStudents(getStudentsReq);
    const students = await studentsResponse.json();
    const student = students.find(s => s.nama_lengkap === 'Points Test Student');
    studentId = student.id;
  });

  afterEach(() => {
    cleanupTest();
  });

  it('should add positive and negative points and calculate total correctly', async () => {
    // 1. Add positive points
    const positivePoint = {
      siswa_id: studentId,
      tanggal: '2024-02-17',
      tipe: 'positif',
      kategori: 'Akademik',
      aktifitas: 'Juara lomba',
      poin: 15,
      keterangan: 'Juara 1 olimpiade matematika',
    };

    const createPositiveReq = new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify(positivePoint),
    });

    const positiveResponse = await createPoint(createPositiveReq);
    expect(positiveResponse.status).toBe(201);

    // 2. Add another positive point
    const positivePoint2 = {
      siswa_id: studentId,
      tanggal: '2024-02-18',
      tipe: 'positif',
      kategori: 'Karakter',
      aktifitas: 'Membantu teman',
      poin: 5,
    };

    const createPositive2Req = new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify(positivePoint2),
    });

    await createPoint(createPositive2Req);

    // 3. Add negative point (violation)
    const negativePoint = {
      siswa_id: studentId,
      tanggal: '2024-02-19',
      tipe: 'negatif',
      kategori: 'Pelanggaran',
      aktifitas: 'Terlambat',
      poin: -3,
      keterangan: 'Terlambat 15 menit',
    };

    const createNegativeReq = new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify(negativePoint),
    });

    await createPoint(createNegativeReq);

    // 4. Fetch all points for this student
    const getPointsReq = new Request(`http://localhost:3000/api/poin?siswa_id=${studentId}`);
    const pointsResponse = await getPoints(getPointsReq);
    const points = await pointsResponse.json();

    expect(points.length).toBe(3);

    // 5. Calculate total points
    const totalPoints = points.reduce((sum, point) => sum + point.poin, 0);
    expect(totalPoints).toBe(17); // 15 + 5 - 3 = 17

    // 6. Verify points are sorted by date (newest first)
    expect(new Date(points[0].tanggal) >= new Date(points[1].tanggal)).toBe(true);
  });

  it('should filter points by type correctly', async () => {
    // Add multiple points
    await createPoint(new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify({
        siswa_id: studentId,
        tanggal: '2024-02-17',
        tipe: 'positif',
        aktifitas: 'Achievement 1',
        poin: 10,
      }),
    }));

    await createPoint(new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify({
        siswa_id: studentId,
        tanggal: '2024-02-18',
        tipe: 'negatif',
        aktifitas: 'Violation 1',
        poin: -5,
      }),
    }));

    // Get only positive points
    const positiveReq = new Request(`http://localhost:3000/api/poin?siswa_id=${studentId}&tipe=positif`);
    const positiveResponse = await getPoints(positiveReq);
    const positivePoints = await positiveResponse.json();

    expect(positivePoints.length).toBe(1);
    expect(positivePoints[0].tipe).toBe('positif');

    // Get only negative points
    const negativeReq = new Request(`http://localhost:3000/api/poin?siswa_id=${studentId}&tipe=negatif`);
    const negativeResponse = await getPoints(negativeReq);
    const negativePoints = await negativeResponse.json();

    expect(negativePoints.length).toBe(1);
    expect(negativePoints[0].tipe).toBe('negatif');
  });

  it('should get points by class (kelas)', async () => {
    // Create another student in different class
    await createStudent(new Request('http://localhost:3000/api/siswa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nama_lengkap: 'Student in 10B',
        kelas: '10B',
      }),
    }));

    const students10B = await (await getStudents(new Request('http://localhost:3000/api/siswa?kelas=10B'))).json();
    const student10BId = students10B[0].id;

    // Add points to both students
    await createPoint(new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify({
        siswa_id: studentId,
        tanggal: '2024-02-17',
        tipe: 'positif',
        aktifitas: 'Test',
        poin: 10,
      }),
    }));

    await createPoint(new Request('http://localhost:3000/api/poin', {
      method: 'POST',
      body: JSON.stringify({
        siswa_id: student10BId,
        tanggal: '2024-02-17',
        tipe: 'positif',
        aktifitas: 'Test',
        poin: 10,
      }),
    }));

    // Get points for class 10A only
    const points10A = await (await getPoints(new Request('http://localhost:3000/api/poin?kelas=10A'))).json();
    
    expect(points10A.length).toBe(1);
    expect(points10A[0].siswa_id).toBe(studentId);
  });
});
