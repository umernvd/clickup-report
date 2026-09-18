import { flattenTasksForReport } from '../src/transform/aggregate.js';

// --- Mock Data ---

const mockTasks = [
  // Task with 1 assignee
  {
    id: 'task_001',
    name: 'Design Homepage',
    url: 'https://app.clickup.com/t/task_001',
    status: { status: 'in progress', type: 'custom' },
    assignees: [
      { id: 'user_1', username: 'Alice', email: 'alice@test.com' },
    ],
    due_date: '1600000000000',
    time_estimate: '7200000',
    listName: 'Design',
    folderName: 'Project Alpha',
    spaceName: 'Main Space',
  },
  // Task with 2 assignees
  {
    id: 'task_002',
    name: 'Build API',
    url: 'https://app.clickup.com/t/task_002',
    status: { status: 'todo', type: 'open' },
    assignees: [
      { id: 'user_1', username: 'Alice', email: 'alice@test.com' },
      { id: 'user_2', username: 'Bob', email: 'bob@test.com' },
    ],
    due_date: null,
    time_estimate: '3600000',
    listName: 'Backend',
    folderName: 'Project Alpha',
    spaceName: 'Main Space',
  },
  // Task with 3 assignees
  {
    id: 'task_003',
    name: 'Code Review',
    url: 'https://app.clickup.com/t/task_003',
    status: { status: 'complete', type: 'done' },
    assignees: [
      { id: 'user_1', username: 'Alice', email: 'alice@test.com' },
      { id: 'user_2', username: 'Bob', email: 'bob@test.com' },
      { id: 'user_3', username: 'Charlie', email: 'charlie@test.com' },
    ],
    due_date: '3000000000000',
    time_estimate: '0',
    listName: 'Backend',
    folderName: 'Project Alpha',
    spaceName: 'Main Space',
  },
  // Unassigned task
  {
    id: 'task_004',
    name: 'Unassigned Task',
    url: 'https://app.clickup.com/t/task_004',
    status: { status: 'open', type: 'open' },
    assignees: [],
    due_date: null,
    time_estimate: '0',
    listName: 'Backend',
    folderName: 'Project Alpha',
    spaceName: 'Main Space',
  },
  // Task with assignees: undefined
  {
    id: 'task_005',
    name: 'No Assignees Field',
    url: 'https://app.clickup.com/t/task_005',
    status: { status: 'open', type: 'open' },
    assignees: undefined,
    due_date: null,
    time_estimate: '0',
    listName: 'Backend',
    folderName: 'Project Alpha',
    spaceName: 'Main Space',
  },
  // Alice's solo task
  {
    id: 'task_006',
    name: 'Write Docs',
    url: 'https://app.clickup.com/t/task_006',
    status: { status: 'todo', type: 'open' },
    assignees: [
      { id: 'user_1', username: 'Alice', email: 'alice@test.com' },
    ],
    due_date: null,
    time_estimate: '1800000',
    listName: 'Docs',
    folderName: 'Project Beta',
    spaceName: 'Secondary Space',
  },
];

// Each time entry includes a `user` field identifying who logged the time.
// Hours are attributed per-user, not per-task.
const mockTimeEntries = [
  { task: { id: 'task_001' }, user: { id: 'user_1', username: 'Alice', email: 'alice@test.com' }, duration: 3600000 },
  { task: { id: 'task_002' }, user: { id: 'user_2', username: 'Bob', email: 'bob@test.com' }, duration: 7200000 },
  { task: { id: 'task_002' }, user: { id: 'user_1', username: 'Alice', email: 'alice@test.com' }, duration: 1800000 },
  { task: { id: 'task_003' }, user: { id: 'user_3', username: 'Charlie', email: 'charlie@test.com' }, duration: 3600000 },
];

// --- Tests ---

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n=== Test 1: Unassigned tasks are excluded ===');
const result = flattenTasksForReport(mockTasks, mockTimeEntries);
const taskNames = result.byTask.map((t) => t.taskName);
assert(!taskNames.includes('Unassigned Task'), 'Unassigned task excluded');
assert(!taskNames.includes('No Assignees Field'), 'Task with undefined assignees excluded');
assert(taskNames.length === 7, `Expected 7 task rows, got ${taskNames.length}`);

console.log('\n=== Test 2: Multi-assignee tasks produce multiple rows ===');
const buildApiRows = result.byTask.filter((t) => t.taskName === 'Build API');
assert(buildApiRows.length === 2, `Build API has 2 rows (one per assignee), got ${buildApiRows.length}`);
assert(buildApiRows[0].assigneeName === 'Alice' || buildApiRows[1].assigneeName === 'Alice', 'Alice assigned to Build API');
assert(buildApiRows[0].assigneeName === 'Bob' || buildApiRows[1].assigneeName === 'Bob', 'Bob assigned to Build API');

const codeReviewRows = result.byTask.filter((t) => t.taskName === 'Code Review');
assert(codeReviewRows.length === 3, `Code Review has 3 rows (one per assignee), got ${codeReviewRows.length}`);
const codeReviewAssignees = codeReviewRows.map((t) => t.assigneeName).sort();
assert(
  codeReviewAssignees[0] === 'Alice' && codeReviewAssignees[1] === 'Bob' && codeReviewAssignees[2] === 'Charlie',
  'Code Review assigned to Alice, Bob, Charlie'
);

console.log('\n=== Test 3: Solo-assignee tasks produce single row ===');
const designRows = result.byTask.filter((t) => t.taskName === 'Design Homepage');
assert(designRows.length === 1, `Design Homepage has 1 row, got ${designRows.length}`);
assert(designRows[0].assigneeName === 'Alice', 'Design Homepage assigned to Alice');

const docsRows = result.byTask.filter((t) => t.taskName === 'Write Docs');
assert(docsRows.length === 1, `Write Docs has 1 row, got ${docsRows.length}`);
assert(docsRows[0].assigneeName === 'Alice', 'Write Docs assigned to Alice');

console.log('\n=== Test 4: Per-user hours are attributed correctly ===');
const buildApiAlice = result.byTask.find((t) => t.taskName === 'Build API' && t.assigneeName === 'Alice');
const buildApiBob = result.byTask.find((t) => t.taskName === 'Build API' && t.assigneeName === 'Bob');
assert(buildApiAlice.hoursLogged === 0.5, `Alice logged 0.5h on Build API, got ${buildApiAlice.hoursLogged}`);
assert(buildApiBob.hoursLogged === 2.0, `Bob logged 2.0h on Build API, got ${buildApiBob.hoursLogged}`);

const codeReviewAlice = result.byTask.find((t) => t.taskName === 'Code Review' && t.assigneeName === 'Alice');
const codeReviewCharlie = result.byTask.find((t) => t.taskName === 'Code Review' && t.assigneeName === 'Charlie');
assert(codeReviewAlice.hoursLogged === 0, `Alice logged 0h on Code Review, got ${codeReviewAlice.hoursLogged}`);
assert(codeReviewCharlie.hoursLogged === 1.0, `Charlie logged 1.0h on Code Review, got ${codeReviewCharlie.hoursLogged}`);

const designAlice = result.byTask.find((t) => t.taskName === 'Design Homepage' && t.assigneeName === 'Alice');
assert(designAlice.hoursLogged === 1.0, `Alice logged 1.0h on Design Homepage, got ${designAlice.hoursLogged}`);

console.log('\n=== Test 5: Summary totals are correct per user ===');
const alice = result.byUserTotal.find((u) => u.assigneeName === 'Alice');
const bob = result.byUserTotal.find((u) => u.assigneeName === 'Bob');
const charlie = result.byUserTotal.find((u) => u.assigneeName === 'Charlie');

assert(alice !== undefined, 'Alice found in summary');
assert(bob !== undefined, 'Bob found in summary');
assert(charlie !== undefined, 'Charlie found in summary');
assert(result.byUserTotal.length === 3, `Expected 3 users in summary, got ${result.byUserTotal.length}`);

// Alice: task_001(1h) + task_002(0.5h) = 1.5h total
// Status: Design Homepage(inProgress), Build API(todo), Code Review(done), Write Docs(todo)
assert(alice.totalHoursLogged === 1.5, `Alice hours: expected 1.5, got ${alice.totalHoursLogged}`);
assert(alice.totalTodo === 2, `Alice todo: expected 2, got ${alice.totalTodo}`);
assert(alice.totalInProgress === 1, `Alice inProgress: expected 1, got ${alice.totalInProgress}`);
assert(alice.totalDone === 1, `Alice done: expected 1, got ${alice.totalDone}`);
assert(alice.projects === 'Main Space, Secondary Space', `Alice projects: expected "Main Space, Secondary Space", got "${alice.projects}"`);

// Bob: task_002(2h) = 2h total (no time on task_003)
// Status: Build API(todo), Code Review(done)
assert(bob.totalHoursLogged === 2, `Bob hours: expected 2, got ${bob.totalHoursLogged}`);
assert(bob.totalTodo === 1, `Bob todo: expected 1, got ${bob.totalTodo}`);
assert(bob.totalInProgress === 0, `Bob inProgress: expected 0, got ${bob.totalInProgress}`);
assert(bob.totalDone === 1, `Bob done: expected 1, got ${bob.totalDone}`);
assert(bob.projects === 'Main Space', `Bob projects: expected "Main Space", got "${bob.projects}"`);

// Charlie: task_003(1h) = 1h total
assert(charlie.totalHoursLogged === 1, `Charlie hours: expected 1, got ${charlie.totalHoursLogged}`);
assert(charlie.totalDone === 1, `Charlie done: expected 1, got ${charlie.totalDone}`);
assert(charlie.projects === 'Main Space', `Charlie projects: expected "Main Space", got "${charlie.projects}"`);

console.log('\n=== Test 6: All task rows have correct fields ===');
for (const row of result.byTask) {
  assert(row.taskName !== '', `Task "${row.taskName}" has non-empty taskName`);
  assert(row.assigneeName !== '', `Task "${row.taskName}" has non-empty assigneeName`);
  assert(row.assigneeEmail !== '', `Task "${row.taskName}" has non-empty assigneeEmail`);
  assert(typeof row.hoursLogged === 'number', `Task "${row.taskName}" has numeric hoursLogged`);
}

// --- Summary ---
console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
