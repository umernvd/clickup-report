const COL_COUNT = 7;
const SUMMARY_COL_COUNT = 11;

const MAIN_HEADER_BG = { red: 0.16, green: 0.22, blue: 0.34 };
const LIST_HEADER_BG = { red: 0.95, green: 0.96, blue: 0.97 };
const HEADER_FORMAT = {
  userEnteredFormat: {
    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
    backgroundColor: MAIN_HEADER_BG,
  },
};
const BORDER_COLOR = { red: 0.85, green: 0.85, blue: 0.85 };
const SECTION_BORDER_COLOR = { red: 0.7, green: 0.7, blue: 0.7 };

async function getOrCreateSheet(sheetsClient, spreadsheetId, weekLabel) {
  let existingSheets;
  try {
    const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
    existingSheets = response.data.sheets;
  } catch (error) {
    throw new Error(`Failed to get spreadsheet: ${error.message}`);
  }

  const existingSheet = existingSheets.find(
    (sheet) => sheet.properties.title === weekLabel,
  );

  if (existingSheet) {
    const sheetId = existingSheet.properties.sheetId;
    console.log(`Using existing tab '${weekLabel}' (id: ${sheetId})`);
    return sheetId;
  }

  try {
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: weekLabel } } }],
      },
    });
    const sheetId = response.data.replies[0].addSheet.properties.sheetId;
    console.log(`Created tab '${weekLabel}' (id: ${sheetId})`);
    return sheetId;
  } catch (error) {
    throw new Error(`Failed to create tab: ${error.message}`);
  }
}

function buildReportRows(byTask) {
  const rows = [];
  const listHeaderIndices = [];
  const taskRowIndices = [];
  const taskByRow = new Map();

  rows.push([
    "Task",
    "List/Project",
    "Project",
    "Assignee",
    "Status",
    "Hours Logged",
    "Due Date",
  ]);

  const tasks = byTask || [];
  const listGroups = new Map();
  for (const t of tasks) {
    const key = `${t.spaceName}||${t.listName}`;
    if (!listGroups.has(key))
      listGroups.set(key, {
        spaceName: t.spaceName,
        listName: t.listName,
        tasks: [],
      });
    listGroups.get(key).tasks.push(t);
  }

  for (const [, group] of listGroups) {
    listHeaderIndices.push(rows.length);
    rows.push([group.listName, "", "", "", "", "", ""]);

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

  rows.push(Array(COL_COUNT).fill(""));

  const taskEndRow =
    listHeaderIndices.length > 0 ? Math.max(...taskRowIndices) + 1 : 1;

  return {
    rows,
    listHeaderIndices,
    taskRowIndices,
    taskByRow,
    taskEndRow,
    listGroups,
  };
}

function buildSummaryRows(rows, byUserTotal) {
  const summaryHeaderRowIdx = rows.length;
  rows.push([
    "SUMMARY BY USER",
    "",
    "",
    "",
    "Todo",
    "In Progress",
    "Done",
    "Total Hours",
    "Cost/Hr",
    "Total Cost",
    "Projects",
  ]);

  for (const u of byUserTotal) {
    rows.push([
      u.assigneeName,
      u.assigneeEmail,
      "",
      "",
      u.totalTodo,
      u.totalInProgress,
      u.totalDone,
      u.totalHoursLogged.toFixed(1),
      "",
      "",
      u.projects,
    ]);
  }

  return { summaryHeaderRowIdx };
}

async function writeSheetData(sheetsClient, spreadsheetId, weekLabel, rows) {
  try {
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: weekLabel,
    });
  } catch (error) {
    console.warn(
      `Clear failed, continuing: ${error.message}`,
    );
  }

  try {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `${weekLabel}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  } catch (error) {
    throw new Error(`Failed to write data: ${error.message}`);
  }
}

function buildHeaderFormatRequests(
  sheetId,
  summaryHeaderRow,
  byUserTotalLength,
) {
  // widths for all columns including summary section (COL_COUNT + extra for summary)
  const allColumnWidths = [
    { columnIndex: 0, width: 300 },
    { columnIndex: 1, width: 180 },
    { columnIndex: 2, width: 120 },
    { columnIndex: 3, width: 140 },
    { columnIndex: 4, width: 110 },
    { columnIndex: 5, width: 110 },
    { columnIndex: 6, width: 100 },
    { columnIndex: 7, width: 90 },
    { columnIndex: 8, width: 100 },
    { columnIndex: 9, width: 200 },
  ];
  return [
    ...allColumnWidths.map(({ columnIndex, width }) => ({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: columnIndex,
          endIndex: columnIndex + 1,
        },
        properties: { pixelSize: width },
        fields: "pixelSize",
      },
    })),
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: COL_COUNT,
        },
        cell: HEADER_FORMAT,
        fields:
          "userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: summaryHeaderRow,
          endRowIndex: summaryHeaderRow + 1,
          startColumnIndex: 0,
          endColumnIndex: SUMMARY_COL_COUNT,
        },
        cell: HEADER_FORMAT,
        fields:
          "userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: summaryHeaderRow,
          endRowIndex: summaryHeaderRow + 1 + byUserTotalLength,
          startColumnIndex: 0,
          endColumnIndex: SUMMARY_COL_COUNT,
        },
        cell: { userEnteredFormat: { horizontalAlignment: "LEFT" } },
        fields: "userEnteredFormat(horizontalAlignment)",
      },
    },
  ];
}

function buildListHeaderRequests(sheetId, listHeaderIndices) {
  return listHeaderIndices.map((ri) => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: ri,
        endRowIndex: ri + 1,
        startColumnIndex: 0,
        endColumnIndex: COL_COUNT,
      },
      cell: {
        userEnteredFormat: {
          textFormat: {
            bold: true,
            foregroundColor: { red: 0.25, green: 0.25, blue: 0.25 },
          },
          backgroundColor: LIST_HEADER_BG,
        },
      },
      fields:
        "userEnteredFormat(textFormat.bold,textFormat.foregroundColor,backgroundColor)",
    },
  }));
}

function buildStatusColorRequests(sheetId, taskRowIndices, rows) {
  const statusColors = {
    Todo: { red: 0.7, green: 0.52, blue: 0.0 },
    "In Progress": { red: 0.15, green: 0.45, blue: 0.7 },
    Done: { red: 0.2, green: 0.55, blue: 0.3 },
  };
  return taskRowIndices
    .map((ri) => {
      const statusVal = rows[ri][4];
      const fg = statusColors[statusVal];
      if (!fg) return undefined;
      return {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: ri,
            endRowIndex: ri + 1,
            startColumnIndex: 4,
            endColumnIndex: 5,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, foregroundColor: fg },
            },
          },
          fields:
            "userEnteredFormat(textFormat.bold,textFormat.foregroundColor)",
        },
      };
    })
    .filter(Boolean);
}

function buildAlternatingRowRequests(sheetId, taskRowIndices) {
  return taskRowIndices
    .filter((_, i) => i % 2 === 1)
    .map((ri) => ({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: ri,
          endRowIndex: ri + 1,
          startColumnIndex: 0,
          endColumnIndex: COL_COUNT,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.97, green: 0.97, blue: 0.98 },
          },
        },
        fields: "userEnteredFormat.backgroundColor",
      },
    }));
}

function buildBorderRequests(
  sheetId,
  taskEndRow,
  summaryHeaderRow,
  byUserTotalLength,
) {
  return [
    {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: taskEndRow,
          startColumnIndex: 0,
          endColumnIndex: COL_COUNT,
        },
        bottom: { style: "SOLID", width: 1, color: BORDER_COLOR },
        innerHorizontal: { style: "SOLID", width: 1, color: BORDER_COLOR },
      },
    },
    {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: summaryHeaderRow,
          endRowIndex: summaryHeaderRow + 1 + byUserTotalLength,
          startColumnIndex: 0,
          endColumnIndex: SUMMARY_COL_COUNT,
        },
        top: { style: "SOLID", width: 1, color: SECTION_BORDER_COLOR },
        bottom: { style: "SOLID", width: 1, color: SECTION_BORDER_COLOR },
        innerHorizontal: { style: "SOLID", width: 1, color: BORDER_COLOR },
      },
    },
  ];
}

function buildHyperlinkRequests(sheetId, taskRowIndices, taskByRow) {
  return taskRowIndices
    .map((ri) => {
      const t = taskByRow.get(ri);
      if (!t) return undefined;
      return {
        updateCells: {
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: t.taskName },
                  textFormatRuns: [
                    {
                      startIndex: 0,
                      format: { link: { uri: t.taskUrl } },
                    },
                  ],
                },
              ],
            },
          ],
          fields: "userEnteredValue,textFormatRuns",
          range: {
            sheetId,
            startRowIndex: ri,
            endRowIndex: ri + 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
        },
      };
    })
    .filter(Boolean);
}

function buildDimensionGroupRequests(
  sheetId,
  listHeaderIndices,
  taskRowIndices,
  taskEndRow,
) {
  const groupReqs = [];
  let currentStart = -1;
  let currentEnd = -1;
  let prevWasTask = false;

  for (let ri = 1; ri <= taskEndRow; ri++) {
    const isListHeader = listHeaderIndices.includes(ri - 1);
    const isTask = taskRowIndices.includes(ri - 1);

    if (isListHeader && prevWasTask && currentStart >= 0) {
      groupReqs.push({
        addDimensionGroup: {
          range: {
            dimension: "ROWS",
            sheetId,
            startIndex: currentStart,
            endIndex: currentEnd,
          },
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

  if (currentStart >= 0 && currentEnd > currentStart + 1) {
    groupReqs.push({
      addDimensionGroup: {
        range: {
          dimension: "ROWS",
          sheetId,
          startIndex: currentStart,
          endIndex: currentEnd,
        },
      },
    });
  }

  return groupReqs;
}

async function applyFormatting(
  sheetsClient,
  spreadsheetId,
  sheetId,
  reportData,
  rows,
  listHeaderIndices,
  taskRowIndices,
  taskByRow,
  taskEndRow,
  listGroups,
  summaryHeaderRowIdx,
) {
  const summaryHeaderRow = summaryHeaderRowIdx;

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: { sheetId },
            fields: "userEnteredFormat",
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: buildHeaderFormatRequests(
        sheetId,
        summaryHeaderRow,
        reportData.byUserTotal.length,
      ),
    },
  });

  if (listHeaderIndices.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: buildListHeaderRequests(sheetId, listHeaderIndices),
      },
    });
  }

  const statusColorRequests = buildStatusColorRequests(
    sheetId,
    taskRowIndices,
    rows,
  );
  if (statusColorRequests.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: statusColorRequests },
    });
  }

  const altRowRequests = buildAlternatingRowRequests(sheetId, taskRowIndices);
  if (altRowRequests.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: altRowRequests },
    });
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: buildBorderRequests(
        sheetId,
        taskEndRow,
        summaryHeaderRow,
        reportData.byUserTotal.length,
      ),
    },
  });

  const hyperlinkRequests = buildHyperlinkRequests(
    sheetId,
    taskRowIndices,
    taskByRow,
  );
  if (hyperlinkRequests.length > 0) {
    for (let i = 0; i < hyperlinkRequests.length; i += 10) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: hyperlinkRequests.slice(i, i + 10) },
      });
    }
  }

  const groupReqs = buildDimensionGroupRequests(
    sheetId,
    listHeaderIndices,
    taskRowIndices,
    taskEndRow,
  );
  if (groupReqs.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: groupReqs },
    });
  }
}

export async function writeWeeklyReport(
  sheetsClient,
  spreadsheetId,
  weekLabel,
  reportData,
) {
  const sheetId = await getOrCreateSheet(
    sheetsClient,
    spreadsheetId,
    weekLabel,
  );

  const {
    rows,
    listHeaderIndices,
    taskRowIndices,
    taskByRow,
    taskEndRow,
    listGroups,
  } = buildReportRows(reportData.byTask);
  const { summaryHeaderRowIdx } = buildSummaryRows(
    rows,
    reportData.byUserTotal,
  );

  await writeSheetData(sheetsClient, spreadsheetId, weekLabel, rows);

  await applyFormatting(
    sheetsClient,
    spreadsheetId,
    sheetId,
    reportData,
    rows,
    listHeaderIndices,
    taskRowIndices,
    taskByRow,
    taskEndRow,
    listGroups,
    summaryHeaderRowIdx,
  );

  return sheetId;
}
