import 'dotenv/config';
import { getConfig } from '../src/config.js';
import { createSheetsClient } from '../src/sheets/client.js';
import { writeWeeklyReport } from '../src/sheets/writer.js';

const config = getConfig();

const dummyReport = {
  byTask: [
    {
      taskName: 'Design login page',
      taskUrl: 'https://app.clickup.com/t/task_001',
      listName: 'Frontend',
      folderName: 'Sprint 1',
      spaceName: 'Engineering',
      assigneeName: 'Alice Johnson',
      assigneeEmail: 'alice@example.com',
      statusCategory: 'inProgress',
      statusLabel: 'In Progress',
      isOverdue: false,
      hoursLogged: 3.5,
      dueDate: 'Sep 20',
    },
    {
      taskName: 'Fix API bug',
      taskUrl: 'https://app.clickup.com/t/task_002',
      listName: 'Frontend',
      folderName: 'Sprint 1',
      spaceName: 'Engineering',
      assigneeName: 'Alice Johnson',
      assigneeEmail: 'alice@example.com',
      statusCategory: 'done',
      statusLabel: 'Done',
      isOverdue: false,
      hoursLogged: 1.5,
      dueDate: 'Sep 15',
    },
    {
      taskName: 'Implement auth endpoint',
      taskUrl: 'https://app.clickup.com/t/task_003',
      listName: 'Backend',
      folderName: 'Sprint 1',
      spaceName: 'Engineering',
      assigneeName: 'Bob Smith',
      assigneeEmail: 'bob@example.com',
      statusCategory: 'todo',
      statusLabel: 'Todo',
      isOverdue: true,
      hoursLogged: 0,
      dueDate: 'Sep 14',
    },
    {
      taskName: 'Write tests',
      taskUrl: 'https://app.clickup.com/t/task_004',
      listName: 'Backend',
      folderName: 'Sprint 1',
      spaceName: 'Engineering',
      assigneeName: 'Bob Smith',
      assigneeEmail: 'bob@example.com',
      statusCategory: 'inProgress',
      statusLabel: 'In Progress',
      isOverdue: false,
      hoursLogged: 2.25,
      dueDate: 'Sep 22',
    },
  ],
  byUserTotal: [
    {
      assigneeName: 'Alice Johnson',
      assigneeEmail: 'alice@example.com',
      totalTodo: 0,
      totalInProgress: 1,
      totalDone: 1,
      totalHoursLogged: 5.0,
      projects: 'Engineering',
    },
    {
      assigneeName: 'Bob Smith',
      assigneeEmail: 'bob@example.com',
      totalTodo: 1,
      totalInProgress: 1,
      totalDone: 0,
      totalHoursLogged: 2.25,
      projects: 'Engineering',
    },
  ],
};

async function testWrite() {
  const sheets = await createSheetsClient(config.googleServiceAccountKey);
  const sheetId = await writeWeeklyReport(
    sheets,
    config.googleSpreadsheetId,
    'TEST - Delete Me',
    dummyReport
  );
  console.log('Test write complete. Sheet ID:', sheetId);
  console.log('Verify in Google Sheets: look for tab "TEST - Delete Me".');
}

testWrite().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
