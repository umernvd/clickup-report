import 'dotenv/config';
import axios from 'axios';
import { getConfig } from '../src/config.js';
import { createClickUpClient } from '../src/clickup/client.js';
import { getAllLists } from '../src/clickup/projects.js';
import { getAllTasks } from '../src/clickup/tasks.js';
import { getCurrentWeekRange, getTimeEntries } from '../src/clickup/timeEntries.js';
import { createSheetsClient } from '../src/sheets/client.js';
import { writeWeeklyReport } from '../src/sheets/writer.js';
import { moveSheetToFirst } from '../src/sheets/reorder.js';
import { flattenTasksForReport } from '../src/transform/aggregate.js';

const config = getConfig();

// Count actual HTTP requests
let clickupRequests = 0;
let googleRequests = 0;

// Instrument ClickUp client
const clickupClient = createClickUpClient(config.clickupToken);
clickupClient.interceptors.request.use((cfg) => {
  clickupRequests++;
  cfg.metadata = { startTime: Date.now() };
  return cfg;
});
clickupClient.interceptors.response.use((res) => {
  const duration = Date.now() - res.config.metadata.startTime;
  console.log(`  [CU #${clickupRequests}] ${res.config.method.toUpperCase()} ${res.config.url?.split('?')[0]} → ${res.status} (${duration}ms)`);
  return res;
});

const pipelineStart = Date.now();

// Step 1 — Config (local)

// Step 2 — Google Auth
const sheetsStart = Date.now();
const sheetsClient = await createSheetsClient(config.googleServiceAccountKey);

// Instrument Google Sheets client
const originalSpreadsheetsGet = sheetsClient.spreadsheets.get.bind(sheetsClient.spreadsheets);
sheetsClient.spreadsheets.get = async (...args) => {
  googleRequests++;
  const start = Date.now();
  const result = await originalSpreadsheetsGet(...args);
  console.log(`  [GS #${googleRequests}] GET spreadsheets.get → 200 (${Date.now() - start}ms)`);
  return result;
};

const originalSpreadsheetsUpdate = sheetsClient.spreadsheets.values.update.bind(sheetsClient.spreadsheets.values);
sheetsClient.spreadsheets.values.update = async (...args) => {
  googleRequests++;
  const start = Date.now();
  const result = await originalSpreadsheetsUpdate(...args);
  console.log(`  [GS #${googleRequests}] PUT spreadsheets.values.update → 200 (${Date.now() - start}ms)`);
  return result;
};

const originalSpreadsheetsBatchUpdate = sheetsClient.spreadsheets.batchUpdate.bind(sheetsClient.spreadsheets);
sheetsClient.spreadsheets.batchUpdate = async (...args) => {
  googleRequests++;
  const start = Date.now();
  const result = await originalSpreadsheetsBatchUpdate(...args);
  console.log(`  [GS #${googleRequests}] POST spreadsheets.batchUpdate → 200 (${Date.now() - start}ms)`);
  return result;
};

// Step 3 — Week range (local)
const { startDate, endDate } = getCurrentWeekRange();

// Step 4 — Lists
console.log('\n--- Step 4: Fetching lists ---');
const lists = await getAllLists(clickupClient, config.clickupTeamId);

// Step 5 — Tasks
console.log('\n--- Step 5: Fetching tasks ---');
const tasks = await getAllTasks(clickupClient, lists);

// Step 6 — Time entries
console.log('\n--- Step 6: Fetching time entries ---');
const timeEntries = await getTimeEntries(clickupClient, config.clickupTeamId, startDate, endDate);

// Step 7 — Aggregate (local)
const report = flattenTasksForReport(tasks, timeEntries);

// Step 8 — Write report
console.log('\n--- Step 8: Writing report ---');
const monday = new Date(startDate);
const weekLabel = `Week of ${monday.toISOString().split('T')[0]}`;
const sheetId = await writeWeeklyReport(sheetsClient, config.googleSpreadsheetId, weekLabel, report);

// Step 9 — Reorder
console.log('\n--- Step 9: Reordering sheet ---');
await moveSheetToFirst(sheetsClient, config.googleSpreadsheetId, sheetId);

const pipelineEnd = Date.now();

console.log('\n=== PERFORMANCE METRICS ===');
console.log(`Total duration: ${pipelineEnd - pipelineStart}ms (${((pipelineEnd - pipelineStart) / 1000).toFixed(2)}s)`);
console.log(`ClickUp API calls: ${clickupRequests}`);
console.log(`Google Sheets API calls: ${googleRequests}`);
console.log(`Total API calls: ${clickupRequests + googleRequests}`);
console.log(`Calls per minute: ${((clickupRequests + googleRequests) / ((pipelineEnd - pipelineStart) / 60000)).toFixed(1)}`);
console.log(`\nData volume:`);
console.log(`  Lists: ${lists.length}`);
console.log(`  Tasks: ${tasks.length}`);
console.log(`  Time entries: ${timeEntries.length}`);
console.log(`  Rows written: ${report.byTask.length + report.byUserTotal.length + 3}`);
console.log(`\nAvg API call duration:`);
console.log(`  ClickUp: N/A (instrumented per-request logging above)`);
