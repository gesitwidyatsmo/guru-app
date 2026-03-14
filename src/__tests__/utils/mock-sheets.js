/**
 * Mock implementation of Google Sheets API for testing
 * This provides an in-memory implementation that simulates Google Sheets behavior
 */

class MockGoogleSpreadsheet {
  constructor(sheetId, auth) {
    this.sheetId = sheetId;
    this.auth = auth;
    this.sheetsByTitle = {};
    this._sheets = [];
  }

  async loadInfo() {
    // Simulate loading spreadsheet info
    return Promise.resolve();
  }

  async addSheet({ title, headerValues }) {
    const sheet = new MockSheet(title, headerValues);
    this.sheetsByTitle[title] = sheet;
    this._sheets.push(sheet);
    return sheet;
  }
}

class MockSheet {
  constructor(title, headerValues = []) {
    this.title = title;
    this.headerValues = headerValues;
    this._rows = [];
  }

  async getRows() {
    return this._rows;
  }

  async addRow(data) {
    const row = new MockRow(data, this.headerValues);
    this._rows.push(row);
    return row;
  }

  async addRows(dataArray) {
    const rows = dataArray.map(data => new MockRow(data, this.headerValues));
    this._rows.push(...rows);
    return rows;
  }

  clearRows() {
    this._rows = [];
  }
}

class MockRow {
  constructor(data, headers) {
    this._data = { ...data };
    this._headers = headers;
  }

  get(field) {
    return this._data[field] || '';
  }

  set(field, value) {
    this._data[field] = value;
  }

  async save() {
    // Simulate saving the row
    return Promise.resolve();
  }

  async delete() {
    // Simulate deleting the row
    return Promise.resolve();
  }
}

/**
 * Mock the getSheet function from lib/sheets.js
 */
export const mockGetSheet = () => {
  const mockDoc = new MockGoogleSpreadsheet('test-sheet-id', {});
  
  // Pre-populate with common sheets
  mockDoc.sheetsByTitle['MASTER_SISWA'] = new MockSheet('MASTER_SISWA', [
    'id', 'nis', 'nama_lengkap', 'kelas', 'jenis_kelamin', 'status'
  ]);
  
  mockDoc.sheetsByTitle['MASTER_POIN'] = new MockSheet('MASTER_POIN', [
    'id', 'siswa_id', 'tanggal', 'tipe', 'kategori', 'aktifitas', 'poin', 'keterangan'
  ]);
  
  mockDoc.sheetsByTitle['MASTER_KELAS'] = new MockSheet('MASTER_KELAS', [
    'id', 'nama', 'tingkat', 'tahun_ajaran'
  ]);
  
  return Promise.resolve(mockDoc);
};

/**
 * Create a mock sheet with sample data
 */
export const createMockSheetWithData = (sheetName, headers, data) => {
  const sheet = new MockSheet(sheetName, headers);
  data.forEach(rowData => {
    sheet._rows.push(new MockRow(rowData, headers));
  });
  return sheet;
};

/**
 * Mock Google Spreadsheet module
 */
export const mockGoogleSpreadsheet = {
  GoogleSpreadsheet: MockGoogleSpreadsheet,
};

/**
 * Mock JWT module
 */
export const mockJWT = {
  JWT: jest.fn().mockImplementation(() => ({})),
};

export { MockGoogleSpreadsheet, MockSheet, MockRow };
