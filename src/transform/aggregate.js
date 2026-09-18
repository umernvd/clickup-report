function categorizeStatus(status) {
  const type = status?.type;
  const name = status?.status?.toLowerCase();

  if (type === 'done') return 'done';
  if (type === 'open' || type === 'unstarted') return 'todo';
  if (type === 'custom') {
    if (name?.includes('done') || name?.includes('complete')) return 'done';
    return 'inProgress';
  }
  return 'todo';
}

function isOverdue(task) {
  if (!task.due_date) return false;
  const due = parseInt(task.due_date, 10);
  return due < Date.now();
}

export function flattenTasksForReport(tasks, timeEntries) {
  const timeByTask = new Map();
  for (const entry of timeEntries) {
    const taskId = entry.task?.id;
    if (!taskId) continue;
    const ms = entry.duration;
    timeByTask.set(taskId, (timeByTask.get(taskId) || 0) + ms);
  }

  const byTask = [];
  for (const task of tasks) {
    const assignees = task.assignees ?? [];
    if (assignees.length === 0) continue;

    const dueDate = task.due_date ? new Date(parseInt(task.due_date, 10)) : null;
    const estimateMs = task.time_estimate ? parseInt(task.time_estimate, 10) : 0;

    for (const assignee of assignees) {
      const statusCat = categorizeStatus(task.status);
      byTask.push({
        taskName: task.name,
        taskUrl: task.url,
        listName: task.listName ?? task.list?.name ?? '',
        folderName: task.folderName ?? task.folder?.name ?? '',
        spaceName: task.spaceName ?? task.space?.name ?? '',
        assigneeName: assignee.username ?? '',
        assigneeEmail: assignee.email ?? '',
        statusCategory: statusCat,
        statusLabel: statusCat === 'todo' ? 'Todo'
          : statusCat === 'inProgress' ? 'In Progress'
          : 'Done',
        isOverdue: isOverdue(task),
        hoursLogged: Math.round(((timeByTask.get(task.id) || 0) / 3_600_000) * 100) / 100,
        dueDate: dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      });
    }
  }
  byTask.sort((a, b) =>
    a.spaceName.localeCompare(b.spaceName) ||
    a.listName.localeCompare(b.listName) ||
    a.taskName.localeCompare(b.taskName)
  );

  const userMap = new Map();
  for (const t of byTask) {
    const key = t.assigneeEmail || t.assigneeName;
    if (!key) continue;
    if (!userMap.has(key)) {
      userMap.set(key, {
        assigneeName: t.assigneeName,
        assigneeEmail: t.assigneeEmail,
        totalTodo: 0,
        totalInProgress: 0,
        totalDone: 0,
        totalHoursLogged: 0,
        projects: new Set(),
      });
    }
    const u = userMap.get(key);
    if (t.statusCategory === 'todo') u.totalTodo++;
    else if (t.statusCategory === 'inProgress') u.totalInProgress++;
    else if (t.statusCategory === 'done') u.totalDone++;
    u.totalHoursLogged += t.hoursLogged;
    if (t.spaceName) u.projects.add(t.spaceName);
  }

  const byUserTotal = Array.from(userMap.values())
    .map((u) => ({
      assigneeName: u.assigneeName,
      assigneeEmail: u.assigneeEmail,
      totalTodo: u.totalTodo,
      totalInProgress: u.totalInProgress,
      totalDone: u.totalDone,
      totalHoursLogged: Math.round(u.totalHoursLogged * 100) / 100,
      projects: Array.from(u.projects).sort().join(', '),
    }))
    .sort((a, b) => a.assigneeName.localeCompare(b.assigneeName));

  console.log(`Tasks: ${byTask.length}, users: ${byUserTotal.length}`);

  return { byTask, byUserTotal };
}
