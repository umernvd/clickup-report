export async function writeWeeklyReport(sheetsClient, spreadsheetId, weekLabel, reportData) {
  let sheetId;

  // Step 1 — Get existing sheets
  let existingSheets;
  try {
    const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
    existingSheets = response.data.sheets;
  } catch (error) {
    throw new Error(`Failed to get spreadsheet: ${error.message}`);
  }

  // Step 2 — Find or create the sheet tab for this week
  const existingSheet = existingSheets.find(
    (sheet) => sheet.properties.title === weekLabel
  );

  if (existingSheet) {
    sheetId = existingSheet.properties.sheetId;
    console.log(`Sheet tab '${weekLabel}' already exists (sheetId: ${sheetId}).`);
  } else {
    try {
      const response = await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: weekLabel } } }],
        },
      });
      sheetId = response.data.replies[0].addSheet.properties.sheetId;
      console.log(`Created new sheet tab '${weekLabel}' (sheetId: ${sheetId}).`);
    } catch (error) {
      throw new Error(`Failed to create sheet tab: ${error.message}`);
    }
  }

  // Step 3 — Build the data rows
  const COL_COUNT = 7;            // Task section: A-G
  const SUMMARY_COL_COUNT = 11;   // Summary section: A-K (extends beyond task section)
  const rows = [];
  // Track which row indices are list headers vs task rows
  const listHeaderIndices = [];   // 0-indexed row positions in rows[]
  const taskRowIndices = [];      // 0-indexed row positions in rows[]
  const taskByRow = new Map();    // row index → task data object

  // Header row (7 columns: A-G)
  rows.push([
    'Task', 'List/Project', 'Project', 'Assignee',
    'Status', 'Hours Logged', 'Due Date',
  ]);

  // Group tasks by list
  const tasks = reportData.byTask || [];
  const listGroups = new Map();
  for (const t of tasks) {
    const key = `${t.spaceName}||${t.listName}`;
    if (!listGroups.has(key)) listGroups.set(key, { spaceName: t.spaceName, listName: t.listName, tasks: [] });
    listGroups.get(key).tasks.push(t);
  }

  // Build rows: list header + task rows per group
  for (const [, group] of listGroups) {
    // List header row
    listHeaderIndices.push(rows.length);
    rows.push([group.listName, '', '', '', '', '', '']);

    // Task rows under this list
    for (const t of group.tasks) {
      const ri = rows.length;
      taskRowIndices.push(ri);
      taskByRow.set(ri, t);
      rows.push([
        t.taskName,
        t.listName,
        t.spaceName,
        t.assigneeName,
        t.statusLabel,
        t.hoursLogged.toFixed(1),
        t.dueDate,
      ]);
    }
  }

  // Empty separator row (7 columns, matching task section)
  rows.push(Array(COL_COUNT).fill(''));

  // Summary header row (11 columns — extends beyond task section)
  const summaryHeaderRowIdx = rows.length;
  rows.push([
    'SUMMARY BY USER', '', '', '',
    'Todo', 'In Progress', 'Done', 'Total Hours',
    'Cost/Hr', 'Total Cost', 'Projects',
  ]);

  // Summary data rows (11 columns)
  for (const u of reportData.byUserTotal) {
    rows.push([
      u.assigneeName,
      u.assigneeEmail,
      '', '',
      u.totalTodo,
      u.totalInProgress,
      u.totalDone,
      u.totalHoursLogged.toFixed(1),
      '',
      '',
      u.projects,
    ]);
  }

  // Step 4 — Clear all existing values then write new data
  try {
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: weekLabel,
    });
  } catch (error) {
    console.warn(`Failed to clear existing values (continuing): ${error.message}`);
  }

  try {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `${weekLabel}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    console.log(`Successfully wrote data to '${weekLabel}'.`);
  } catch (error) {
    throw new Error(`Failed to write data to sheet: ${error.message}`);
  }

  // Step 5 — Format and structure the sheet
  const lastDataRow = rows.length - 1;
  const summaryHeaderRow = summaryHeaderRowIdx;
  const mainHeaderBg = { red: 0.16, green: 0.22, blue: 0.34 };
  const listHeaderBg = { red: 0.95, green: 0.96, blue: 0.97 };
  const listHeaderFg = { red: 0.25, green: 0.25, blue: 0.25 };
  const altRowBg = { red: 0.97, green: 0.97, blue: 0.98 };
  const statusTextColors = {
    Todo: { red: 0.7, green: 0.52, blue: 0.0 },
    'In Progress': { red: 0.15, green: 0.45, blue: 0.7 },
    Done: { red: 0.2, green: 0.55, blue: 0.3 },
  };

  // Column widths in pixels (task section: A-I)
  const columnWidths = [
    { columnIndex: 0, width: 300 },  // Task
    { columnIndex: 1, width: 180 },  // List/Project
    { columnIndex: 2, width: 120 },  // Project (Space)
    { columnIndex: 3, width: 140 },  // Assignee
    { columnIndex: 4, width: 110 },  // Status
    { columnIndex: 5, width: 110 },  // Hours Logged
    { columnIndex: 6, width: 100 },  // Due Date
    { columnIndex: 7, width: 90 },   // Cost/Hr (summary only)
    { columnIndex: 8, width: 100 },  // Total Cost (summary only)
    { columnIndex: 9, width: 200 },  // Projects (summary only)
  ];

  const headerFormat = {
    userEnteredFormat: {
      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      backgroundColor: mainHeaderBg,
    },
  };

  try {
    // 1. Clear ALL existing formatting
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: { sheetId },
            fields: 'userEnteredFormat',
          },
        }],
      },
    });

    // 2. Column widths + freeze header + format headers (combined into one batchUpdate)
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          ...columnWidths.map(({ columnIndex, width }) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: columnIndex, endIndex: columnIndex + 1 },
              properties: { pixelSize: width },
              fields: 'pixelSize',
            },
          })),
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COL_COUNT },
              cell: headerFormat,
              fields: 'userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: summaryHeaderRow, endRowIndex: summaryHeaderRow + 1, startColumnIndex: 0, endColumnIndex: SUMMARY_COL_COUNT },
              cell: headerFormat,
              fields: 'userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: summaryHeaderRow,
                endRowIndex: summaryHeaderRow + 1 + reportData.byUserTotal.length,
                startColumnIndex: 0,
                endColumnIndex: SUMMARY_COL_COUNT,
              },
              cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
              fields: 'userEnteredFormat(horizontalAlignment)',
            },
          },
        ],
      },
    });

    // 3. Format list header rows (light gray bg, bold)
    if (listHeaderIndices.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: listHeaderIndices.map((ri) => ({
            repeatCell: {
              range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 0, endColumnIndex: COL_COUNT },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, foregroundColor: listHeaderFg },
                  backgroundColor: listHeaderBg,
                },
              },
              fields: 'userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)',
            },
          })),
        },
      });
    }

    // 4. Color-code status column (col 4) for task rows — text color only, no background
    const statusColorRequests = taskRowIndices.map((ri) => {
      const statusVal = rows[ri][4];
      const fg = statusTextColors[statusVal];
      if (!fg) return null;
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: fg } } },
          fields: 'userEnteredFormat(textFormat.bold,textFormat.foregroundColor)',
        },
      };
    }).filter(Boolean);

    if (statusColorRequests.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: statusColorRequests },
      });
    }

    // 5. Alternating row tints for task rows (every other row gets subtle gray)
    const altRowRequests = taskRowIndices
      .filter((_, i) => i % 2 === 1)
      .map((ri) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 0, endColumnIndex: COL_COUNT },
          cell: { userEnteredFormat: { backgroundColor: altRowBg } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      }));

    if (altRowRequests.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: altRowRequests },
      });
    }

    // 6. Borders — horizontal lines only for clean separation
    const taskEndRow = listHeaderIndices.length > 0
      ? Math.max(...taskRowIndices) + 1
      : 1;

    const borderColor = { red: 0.85, green: 0.85, blue: 0.85 };
    const sectionBorderColor = { red: 0.7, green: 0.7, blue: 0.7 };

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateBorders: {
              range: { sheetId, startRowIndex: 0, endRowIndex: taskEndRow, startColumnIndex: 0, endColumnIndex: COL_COUNT },
              bottom: { style: 'SOLID', width: 1, color: borderColor },
              innerHorizontal: { style: 'SOLID', width: 1, color: borderColor },
            },
          },
          {
            updateBorders: {
              range: { sheetId, startRowIndex: summaryHeaderRow, endRowIndex: summaryHeaderRow + 1 + reportData.byUserTotal.length, startColumnIndex: 0, endColumnIndex: SUMMARY_COL_COUNT },
              top: { style: 'SOLID', width: 1, color: sectionBorderColor },
              bottom: { style: 'SOLID', width: 1, color: sectionBorderColor },
              innerHorizontal: { style: 'SOLID', width: 1, color: borderColor },
            },
          },
        ],
      },
    });

    // 7. Hyperlinks for task names (column A) — only on task rows, not list headers
    const hyperlinkRequests = taskRowIndices.map((ri) => {
      const t = taskByRow.get(ri);
      if (!t) return null;
      return {
        updateCells: {
          rows: [{
            values: [{
              userEnteredValue: { stringValue: t.taskName },
              textFormatRuns: [{
                startIndex: 0,
                format: { link: { uri: t.taskUrl } },
              }],
            }],
          }],
          fields: 'userEnteredValue,textFormatRuns',
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 0, endColumnIndex: 1 },
        },
      };
    }).filter(Boolean);

    if (hyperlinkRequests.length > 0) {
      // Send in batches of 10 to avoid payload limits
      for (let i = 0; i < hyperlinkRequests.length; i += 10) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: hyperlinkRequests.slice(i, i + 10) },
        });
      }
    }

    // 8. Row groups — one group per list (user can collapse with +/- controls)
    if (listGroups.size > 0) {
      const groupReqs = [];
      let currentStart = -1;
      let currentEnd = -1;
      let prevWasTask = false;

      for (let ri = 1; ri <= taskEndRow; ri++) {
        const isListHeader = listHeaderIndices.includes(ri - 1);
        const isTask = taskRowIndices.includes(ri - 1);

        if (isListHeader && prevWasTask && currentStart >= 0) {
          // End previous group
          groupReqs.push({
            addDimensionGroup: {
              range: { dimension: 'ROWS', sheetId, startIndex: currentStart, endIndex: currentEnd },
            },
          });
          currentStart = -1;
        }

        if (isListHeader) {
          currentStart = ri;
          currentEnd = ri + 1;
          prevWasTask = false;
        } else if (isTask) {
          currentEnd = ri + 1;
          prevWasTask = true;
        }
      }

      // Close last group
      if (currentStart >= 0 && currentEnd > currentStart + 1) {
        groupReqs.push({
          addDimensionGroup: {
            range: { dimension: 'ROWS', sheetId, startIndex: currentStart, endIndex: currentEnd },
          },
        });
      }

      if (groupReqs.length > 0) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: groupReqs },
        });
      }
    }

    console.log(`Applied formatting to '${weekLabel}'.`);
  } catch (error) {
    console.warn(`Formatting failed (non-critical): ${error.message}`);
  }

  return sheetId;
}
