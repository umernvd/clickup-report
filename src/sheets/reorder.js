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
              fields: "index",
            },
          },
        ],
      },
    });

    console.log("Sheet reordered");
  } catch (error) {
    console.warn(`Failed to reorder sheet: ${error.message}`);
  }
}
