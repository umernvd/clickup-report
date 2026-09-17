import { google } from 'googleapis';

export async function createSheetsClient(serviceAccountJson) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountJson,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    await auth.getClient();

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Google Sheets client authenticated successfully.');
    return sheets;
  } catch (error) {
    throw new Error(
      `Google authentication failed: ${error.message}. Check that GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON and the service account has been shared on the spreadsheet as an Editor.`
    );
  }
}
