import { google } from "googleapis";

export async function createSheetsClient(serviceAccountJson) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountJson,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    console.log("Sheets client authenticated");
    return sheets;
  } catch (error) {
    throw new Error(`Google auth failed: ${error.message}`);
  }
}
