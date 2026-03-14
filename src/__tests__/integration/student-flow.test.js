/**
 * Integration tests for student management flow
 * Tests complete workflow: Create → Read → Update → Delete
 */

import { GET as getStudents, POST as createStudent, PUT as updateStudent, DELETE as deleteStudent } from '@/app/api/siswa/route';
import { mockGetSheet } from '@/__tests__/utils/mock-sheets';
import { setupTest, cleanupTest } from '@/__tests__/utils/test-helpers';

jest.mock('@/lib/sheets', () => ({
  getSheet: jest.fn(),
}));

const { getSheet } = require('@/lib/sheets');

describe('Student Management Integration Flow', () => {
  let mockDoc;
  let createdStudentId;

  beforeEach(async () => {
    setupTest();
    mockDoc = await mockGetSheet();
    getSheet.mockResolvedValue(mockDoc);
  });

  afterEach(() => {
    cleanupTest();
  });

  it('should complete full student lifecycle: create → read → update → delete', async () => {
    // 1. CREATE - Add a new student
    const newStudent = {
      nis: '10001',
      nama_lengkap: 'Integration Test Student',
      kelas: '10A',
      jenis_kelamin: 'Laki-laki',
      status: 'Aktif',
    };

    const createReq = new Request('http://localhost:3000/api/siswa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newStudent),
    });

    const createResponse = await createStudent(createReq);
    const createData = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createData.success).toBe(true);

    // 2. READ - Fetch all students and verify the new student exists
    const readReq = new Request('http://localhost:3000/api/siswa?kelas=10A');
    const readResponse = await getStudents(readReq);
    const students = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(students.length).toBeGreaterThan(0);
    
    const foundStudent = students.find(s => s.nama_lengkap === 'Integration Test Student');
    expect(foundStudent).toBeDefined();
    expect(foundStudent.nis).toBe('10001');
    expect(foundStudent.kelas).toBe('10A');
    
    createdStudentId = foundStudent.id;

    // 3. UPDATE - Modify the student's information
    const updateReq = new Request('http://localhost:3000/api/siswa', {
      method: 'PUT',
      body: JSON.stringify({
        id: createdStudentId,
        nama_lengkap: 'Updated Test Student',
        kelas: '11A',
      }),
    });

    const updateResponse = await updateStudent(updateReq);
    const updateData = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateData.success).toBe(true);

    // 4. READ AGAIN - Verify the update
    const readAgainReq = new Request('http://localhost:3000/api/siswa?kelas=11A');
    const readAgainResponse = await getStudents(readAgainReq);
    const updatedStudents = await readAgainResponse.json();

    const updatedStudent = updatedStudents.find(s => s.id === createdStudentId);
    expect(updatedStudent).toBeDefined();
    expect(updatedStudent.nama_lengkap).toBe('Updated Test Student');
    expect(updatedStudent.kelas).toBe('11A');

    // 5. DELETE - Remove the student
    const deleteReq = new Request(`http://localhost:3000/api/siswa?id=${createdStudentId}`, {
      method: 'DELETE',
    });

    const deleteResponse = await deleteStudent(deleteReq);
    const deleteData = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);

    // 6. VERIFY DELETION - Ensure student no longer exists
    const finalReadReq = new Request('http://localhost:3000/api/siswa');
    const finalReadResponse = await getStudents(finalReadReq);
    const finalStudents = await finalReadResponse.json();

    const deletedStudent = finalStudents.find(s => s.id === createdStudentId);
    expect(deletedStudent).toBeUndefined();
  });

  it('should handle concurrent student operations', async () => {
    // Create multiple students concurrently
    const students = [
      { nama_lengkap: 'Student A', kelas: '10A' },
      { nama_lengkap: 'Student B', kelas: '10A' },
      { nama_lengkap: 'Student C', kelas: '10B' },
    ];

    const createPromises = students.map(student => 
      createStudent(new Request('http://localhost:3000/api/siswa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(student),
      }))
    );

    const responses = await Promise.all(createPromises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Verify all students were created
    const readReq = new Request('http://localhost:3000/api/siswa');
    const readResponse = await getStudents(readReq);
    const allStudents = await readResponse.json();

    expect(allStudents.length).toBeGreaterThanOrEqual(3);
  });
});
