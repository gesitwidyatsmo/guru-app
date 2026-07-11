import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const LOGGED_IN_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

const auth = new JWT({
	email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
	key: LOGGED_IN_KEY,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function check() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['MASTER_NILAI'];
    if (sheet) {
        await sheet.loadHeaderRow();
        console.log("Headers:", sheet.headerValues);
    } else {
        console.log("Sheet not found");
    }
}
check();
