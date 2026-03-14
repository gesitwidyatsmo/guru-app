/**
 * Unit tests for lib/sheets.js
 * Tests Google Sheets connection and utility functions
 */

import { getSheet } from '@/lib/sheets';

// Mock google-spreadsheet
jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
    loadInfo: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock google-auth-library
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({})),
}));

describe('lib/sheets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-private-key\\nwith-newline';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getSheet', () => {
    it('should create and return a GoogleSpreadsheet instance', async () => {
      const doc = await getSheet();
      
      expect(doc).toBeDefined();
      expect(doc.loadInfo).toHaveBeenCalled();
    });

    it('should throw error when GOOGLE_SHEET_ID is missing', async () => {
      delete process.env.GOOGLE_SHEET_ID;

      await expect(getSheet()).rejects.toThrow('GOOGLE_SHEET_ID belum diset');
    });

    it('should handle newline characters in private key', async () => {
      process.env.GOOGLE_PRIVATE_KEY = 'key\\nwith\\nnewlines';
      
      const doc = await getSheet();
      
      expect(doc).toBeDefined();
    });
  });
});
