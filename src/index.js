import 'dotenv/config';
import { getConfig } from './config.js';
import { createClickUpClient } from './clickup/client.js';
import { getAllLists } from './clickup/projects.js';
import { getAllTasks } from './clickup/tasks.js';
import { getCurrentWeekRange, getTimeEntries } from './clickup/timeEntries.js';
import { createSheetsClient } from './sheets/client.js';
import { writeWeeklyReport } from './sheets/writer.js';
import { moveSheetToFirst } from './sheets/reorder.js';
import { flattenTasksForReport } from './transform/aggregate.js';

export async function runPipeline() {
  const config = getConfig();
  console.log('1/9 — Configuration loaded.');

  const clickupClient = createClickUpClient(config.clickupToken);
  const sheetsClient = await createSheetsClient(config.googleServiceAccountKey);
  console.log('2/9 — API clients initialized.');

  const { startDate, endDate } = getCurrentWeekRange();
  console.log('3/9 — Current week range determined.');

  const lists = await getAllLists(clickupClient, config.clickupTeamId);
  console.log(`4/9 — Lists fetched: ${lists.length} lists found.`);
  if (lists.length === 0) {
    console.warn('WARNING: No lists found. The report will be empty.');
  }

  const tasks = await getAllTasks(clickupClient, lists);
  console.log(`5/9 — Tasks fetched: ${tasks.length} tasks found.`);
  if (tasks.length === 0) {
    console.warn('WARNING: No tasks found across all lists. The report will have no task rows.');
  }

  const timeEntries = await getTimeEntries(clickupClient, config.clickupTeamId, startDate, endDate);
  console.log(`6/9 — Time entries fetched: ${timeEntries.length} entries found.`);
  if (timeEntries.length === 0) {
    console.warn('WARNING: No time entries found for this week. All "Hours Logged" values will be 0.');
  }

  const report = flattenTasksForReport(tasks, timeEntries);
  console.log('7/9 — Data aggregated.');

  const monday = new Date(startDate);
  const weekLabel = `Week of ${monday.toISOString().split('T')[0]}`;
  const sheetId = await writeWeeklyReport(sheetsClient, config.googleSpreadsheetId, weekLabel, report);
  console.log(`8/9 — Report written to sheet: ${weekLabel}.`);

  await moveSheetToFirst(sheetsClient, config.googleSpreadsheetId, sheetId);
  console.log('9/9 — Sheet reordered. Pipeline complete.');

  return {
    weekLabel,
    sheetId,
    taskCount: report.byTask.length,
    userCount: report.byUserTotal.length,
  };
}

// CLI entry point — only runs when executed directly (not imported by Lambda handler)
const isDirectExecution = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectExecution) {
  runPipeline().catch((err) => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  });
}
