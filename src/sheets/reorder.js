export async function moveSheetToFirst(sheetsClient, spreadsheetId, sheetId) {
  try {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                index: 0,
              },
              fields: 'index',
            },
          },
        ],
      },
    });

    console.log('Sheet moved to first position.');
  } catch (error) {
    console.warn(`Failed to reorder sheet (non-critical): ${error.message}`);
  }
}
