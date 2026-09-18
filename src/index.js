import "dotenv/config";
import { getConfig } from "./config.js";
import { createClickUpClient } from "./clickup/client.js";
import { getAllLists } from "./clickup/projects.js";
import { getAllTasks } from "./clickup/tasks.js";
import { getCurrentWeekRange, getTimeEntries } from "./clickup/timeEntries.js";
import { createSheetsClient } from "./sheets/client.js";
import { writeWeeklyReport } from "./sheets/writer.js";
import { moveSheetToFirst } from "./sheets/reorder.js";
import { flattenTasksForReport } from "./transform/aggregate.js";

export async function runPipeline() {
  const config = getConfig();

  const clickupClient = createClickUpClient(config.clickupToken);
  const sheetsClient = await createSheetsClient(config.googleServiceAccountKey);

  const { startDate, endDate } = getCurrentWeekRange();

  const lists = await getAllLists(clickupClient, config.clickupTeamId);
  console.log(`Lists: ${lists.length}`);

  const tasks = await getAllTasks(clickupClient, lists);
  console.log(`Tasks: ${tasks.length}`);

  const timeEntries = await getTimeEntries(
    clickupClient,
    config.clickupTeamId,
    startDate,
    endDate,
  );
  console.log(`Time entries: ${timeEntries.length}`);

  const report = flattenTasksForReport(tasks, timeEntries);

  const monday = new Date(startDate);
  const weekLabel = `Week of ${monday.toISOString().split("T")[0]}`;
  const sheetId = await writeWeeklyReport(
    sheetsClient,
    config.googleSpreadsheetId,
    weekLabel,
    report,
  );
  console.log(
    `Report: ${weekLabel} (${report.byTask.length} rows, ${report.byUserTotal.length} users)`,
  );

  await moveSheetToFirst(sheetsClient, config.googleSpreadsheetId, sheetId);

  return {
    weekLabel,
    sheetId,
    taskCount: report.byTask.length,
    userCount: report.byUserTotal.length,
  };
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  runPipeline().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
