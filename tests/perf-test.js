import 'dotenv/config';
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
const clickupClient = createClickUpClient(config.clickupToken);

let apiCalls = 0;
const callLog = [];

function logCall(label, startTime, endTime) {
  const duration = endTime - startTime;
  apiCalls++;
  callLog.push({ call: apiCalls, label, duration });
}

async function measure(label, fn) {
  const start = Date.now();
  const result = await fn();
  logCall(label, start, Date.now());
  return result;
}

const pipelineStart = Date.now();

// Step 1

// Step 2
const sheetsStart = Date.now();
const sheetsClient = await createSheetsClient(config.googleServiceAccountKey);
logCall('Google Auth', sheetsStart, Date.now());

// Step 3
const weekStart = Date.now();
const { startDate, endDate } = getCurrentWeekRange();
logCall('getCurrentWeekRange (local)', weekStart, Date.now());

// Step 4 — getAllLists makes multiple API calls internally
const listsStart = Date.now();
const lists = await getAllLists(clickupClient, config.clickupTeamId);
logCall('getAllLists (full)', listsStart, Date.now());

// Step 5 — getAllTasks makes multiple API calls internally
const tasksStart = Date.now();
const tasks = await getAllTasks(clickupClient, lists);
logCall('getAllTasks (full)', tasksStart, Date.now());

// Step 6 — getTimeEntries
const timeStart = Date.now();
const timeEntries = await getTimeEntries(clickupClient, config.clickupTeamId, startDate, endDate);
logCall('getTimeEntries', timeStart, Date.now());

// Step 7 — aggregate (local)
const aggStart = Date.now();
const report = flattenTasksForReport(tasks, timeEntries);
logCall('flattenTasksForReport (local)', aggStart, Date.now());

// Step 8 — writeWeeklyReport makes multiple API calls internally
const monday = new Date(startDate);
const weekLabel = `Week of ${monday.toISOString().split('T')[0]}`;
const writeStart = Date.now();
const sheetId = await writeWeeklyReport(sheetsClient, config.googleSpreadsheetId, weekLabel, report);
logCall('writeWeeklyReport (full)', writeStart, Date.now());

// Step 9 — moveSheetToFirst
const reorderStart = Date.now();
await moveSheetToFirst(sheetsClient, config.googleSpreadsheetId, sheetId);
logCall('moveSheetToFirst', reorderStart, Date.now());

const pipelineEnd = Date.now();
const totalDuration = pipelineEnd - pipelineStart;

// Count actual API calls from ClickUp (excluding local ops and Google)
// We need to instrument the client to count actual HTTP requests
console.log('\n=== PERFORMANCE METRICS ===\n');
console.log('Total pipeline duration:', totalDuration, 'ms (' + (totalDuration / 1000).toFixed(2) + 's)');
console.log('\nStep-level timings:');
callLog.forEach(c => {
  const type = c.label.includes('local') ? '[LOCAL]' : '[API]';
  console.log(`  ${String(c.call).padStart(2)}. ${type} ${c.label}: ${c.duration}ms`);
});

console.log('\nBreakdown by operation:');
const apiOps = callLog.filter(c => !c.label.includes('local'));
const localOps = callLog.filter(c => c.label.includes('local'));
console.log(`  API operations: ${apiOps.length} calls, total ${apiOps.reduce((s, c) => s + c.duration, 0)}ms`);
console.log(`  Local operations: ${localOps.length} calls, total ${localOps.reduce((s, c) => s + c.duration, 0)}ms`);
console.log(`  Lists: ${lists.length}, Tasks: ${tasks.length}, Time entries: ${timeEntries.length}`);
