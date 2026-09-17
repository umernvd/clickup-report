import 'dotenv/config';
import { getConfig } from '../src/config.js';
import { createSheetsClient } from '../src/sheets/client.js';
import { writeWeeklyReport } from '../src/sheets/writer.js';

const config = getConfig();

const multiUserReport = {
  byTask: [
    // Alice solo task — overdue
    {
      taskName: 'Design Homepage',
      taskUrl: 'https://app.clickup.com/t/task_001',
      listName: 'Design',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Alice',
      assigneeEmail: 'alice@test.com',
      statusCategory: 'inProgress',
      statusLabel: 'In Progress',
      isOverdue: true,
      hoursLogged: 1,
      dueDate: 'Sep 10',
    },
    // Build API — Alice row
    {
      taskName: 'Build API',
      taskUrl: 'https://app.clickup.com/t/task_002',
      listName: 'Backend',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Alice',
      assigneeEmail: 'alice@test.com',
      statusCategory: 'todo',
      statusLabel: 'Todo',
      isOverdue: false,
      hoursLogged: 2.5,
      dueDate: '',
    },
    // Build API — Bob row
    {
      taskName: 'Build API',
      taskUrl: 'https://app.clickup.com/t/task_002',
      listName: 'Backend',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Bob',
      assigneeEmail: 'bob@test.com',
      statusCategory: 'todo',
      statusLabel: 'Todo',
      isOverdue: false,
      hoursLogged: 2.5,
      dueDate: '',
    },
    // Code Review — Alice row
    {
      taskName: 'Code Review',
      taskUrl: 'https://app.clickup.com/t/task_003',
      listName: 'Backend',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Alice',
      assigneeEmail: 'alice@test.com',
      statusCategory: 'done',
      statusLabel: 'Done',
      isOverdue: false,
      hoursLogged: 1,
      dueDate: 'Sep 25',
    },
    // Code Review — Bob row
    {
      taskName: 'Code Review',
      taskUrl: 'https://app.clickup.com/t/task_003',
      listName: 'Backend',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Bob',
      assigneeEmail: 'bob@test.com',
      statusCategory: 'done',
      statusLabel: 'Done',
      isOverdue: false,
      hoursLogged: 1,
      dueDate: 'Sep 25',
    },
    // Code Review — Charlie row
    {
      taskName: 'Code Review',
      taskUrl: 'https://app.clickup.com/t/task_003',
      listName: 'Backend',
      folderName: 'Project Alpha',
      spaceName: 'Main Space',
      assigneeName: 'Charlie',
      assigneeEmail: 'charlie@test.com',
      statusCategory: 'done',
      statusLabel: 'Done',
      isOverdue: false,
      hoursLogged: 1,
      dueDate: 'Sep 25',
    },
    // Alice solo task — Write Docs
    {
      taskName: 'Write Docs',
      taskUrl: 'https://app.clickup.com/t/task_006',
      listName: 'Docs',
      folderName: 'Project Beta',
      spaceName: 'Secondary Space',
      assigneeName: 'Alice',
      assigneeEmail: 'alice@test.com',
      statusCategory: 'todo',
      statusLabel: 'Todo',
      isOverdue: false,
      hoursLogged: 0,
      dueDate: '',
    },
  ],
  byUserTotal: [
    {
      assigneeName: 'Alice',
      assigneeEmail: 'alice@test.com',
      totalTodo: 2,
      totalInProgress: 1,
      totalDone: 1,
      totalHoursLogged: 4.5,
      projects: 'Main Space, Secondary Space',
    },
    {
      assigneeName: 'Bob',
      assigneeEmail: 'bob@test.com',
      totalTodo: 1,
      totalInProgress: 0,
      totalDone: 1,
      totalHoursLogged: 3.5,
      projects: 'Main Space',
    },
    {
      assigneeName: 'Charlie',
      assigneeEmail: 'charlie@test.com',
      totalTodo: 0,
      totalInProgress: 0,
      totalDone: 1,
      totalHoursLogged: 1,
      projects: 'Main Space',
    },
  ],
};

async function testMultiUserWrite() {
  const sheets = await createSheetsClient(config.googleServiceAccountKey);
  const sheetId = await writeWeeklyReport(
    sheets,
    config.googleSpreadsheetId,
    'TEST - Multi-User',
    multiUserReport
  );
  console.log('Multi-user test write complete. Sheet ID:', sheetId);
  console.log('Verify in Google Sheets: look for tab "TEST - Multi-User".');
}

testMultiUserWrite().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
