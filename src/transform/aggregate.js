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

export function aggregateReport(tasks, timeEntries) {
  const map = new Map();
  const now = Date.now();

  for (const task of tasks) {
    const listId = task.list?.id ?? task.listId;
    const listName = task.list?.name ?? task.listName;
    const folderName = task.folderName;
    const spaceName = task.spaceName;
    const statusCat = categorizeStatus(task.status);
    const overdue = isOverdue(task);
    const estimateMs = task.time_estimate ? parseInt(task.time_estimate, 10) : 0;

    for (const assignee of task.assignees ?? []) {
      const key = `${assignee.id}:${listId}`;

      if (!map.has(key)) {
        map.set(key, {
          userId: assignee.id,
          userName: assignee.username,
          userEmail: assignee.email,
          listId,
          listName,
          folderName,
          spaceName,
          tasksAssigned: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          overdueCount: 0,
          totalMs: 0,
          estimatedMs: 0,
        });
      }

      const record = map.get(key);
      record.tasksAssigned += 1;
      record[statusCat] += 1;
      if (overdue) record.overdueCount += 1;
      record.estimatedMs += estimateMs;
    }
  }

  for (const entry of timeEntries) {
    const userId = entry.user?.id;
    const listId = entry.task_location?.list_id ?? entry.task?.list?.id;

    if (userId == null || listId == null) continue;

    const key = `${userId}:${listId}`;

    if (map.has(key)) {
      map.get(key).totalMs += entry.duration;
    }
  }

  const byUserAndProject = Array.from(map.values())
    .map((record) => ({
      userId: record.userId,
      userName: record.userName,
      userEmail: record.userEmail,
      listId: record.listId,
      listName: record.listName,
      folderName: record.folderName,
      spaceName: record.spaceName,
      tasksAssigned: record.tasksAssigned,
      todo: record.todo,
      inProgress: record.inProgress,
      done: record.done,
      overdueCount: record.overdueCount,
      hoursLogged: Math.round((record.totalMs / 3_600_000) * 100) / 100,
      estimatedHours: Math.round((record.estimatedMs / 3_600_000) * 100) / 100,
    }))
    .sort((a, b) =>
      a.spaceName.localeCompare(b.spaceName) ||
      a.listName.localeCompare(b.listName) ||
      a.userName.localeCompare(b.userName)
    );

  const userMap = new Map();
  for (const record of byUserAndProject) {
    const key = record.userId;

    if (!userMap.has(key)) {
      userMap.set(key, {
        userId: record.userId,
        userName: record.userName,
        userEmail: record.userEmail,
        totalHoursLogged: 0,
        totalEstimatedHours: 0,
        totalTasksAssigned: 0,
        totalTodo: 0,
        totalInProgress: 0,
        totalDone: 0,
        totalOverdue: 0,
      });
    }

    const user = userMap.get(key);
    user.totalHoursLogged += record.hoursLogged;
    user.totalEstimatedHours += record.estimatedHours;
    user.totalTasksAssigned += record.tasksAssigned;
    user.totalTodo += record.todo;
    user.totalInProgress += record.inProgress;
    user.totalDone += record.done;
    user.totalOverdue += record.overdueCount;
  }

  const byUserTotal = Array.from(userMap.values())
    .map((user) => ({
      ...user,
      totalHoursLogged: Math.round(user.totalHoursLogged * 100) / 100,
      totalEstimatedHours: Math.round(user.totalEstimatedHours * 100) / 100,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName));

  console.log(
    `Aggregation complete. Unique user+list combinations: ${byUserAndProject.length}. Unique users: ${byUserTotal.length}. Total time entries processed: ${timeEntries.length}.`
  );

  return { byUserAndProject, byUserTotal };
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
      byTask.push({
        taskName: task.name,
        taskUrl: task.url,
        listName: task.listName ?? task.list?.name ?? '',
        folderName: task.folderName ?? task.folder?.name ?? '',
        spaceName: task.spaceName ?? task.space?.name ?? '',
        assigneeName: assignee.username ?? '',
        assigneeEmail: assignee.email ?? '',
        statusCategory: categorizeStatus(task.status),
        statusLabel: categorizeStatus(task.status) === 'todo' ? 'Todo'
          : categorizeStatus(task.status) === 'inProgress' ? 'In Progress'
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
    const key = t.assigneeName;
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

  console.log(
    `Task flattening complete. Tasks: ${byTask.length}. Unique assignees: ${byUserTotal.length}.`
  );

  return { byTask, byUserTotal };
}
