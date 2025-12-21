import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// LOGIKA PEMBERSIHAN KUNCI (Biar aman dari error \n)
const LOGGED_IN_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

if (!LOGGED_IN_KEY) {
	console.error('ERROR: GOOGLE_PRIVATE_KEY belum diset di .env.local');
}

const serviceAccountAuth = new JWT({
	email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
	key: LOGGED_IN_KEY,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const getSheet = async () => {
	// Pastikan ID Spreadsheet ada
	if (!process.env.GOOGLE_SHEET_ID) {
		throw new Error('GOOGLE_SHEET_ID belum diset di .env.local');
	}

	const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
	await doc.loadInfo();
	return doc;
};
