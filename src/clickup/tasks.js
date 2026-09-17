import { fetchAllPages } from './pagination.js';

export async function getTasksForList(client, listId) {
  const tasks = await fetchAllPages((page) =>
    client.get(`/list/${listId}/task`, {
      params: { include_closed: true, subtasks: true, page },
    }).then((res) => res.data.tasks)
  );
  return tasks;
}

export async function getAllTasks(client, lists) {
  const allTasks = [];

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    console.log(`Fetching tasks for list: ${list.name} (${i + 1}/${lists.length})`);

    try {
      const tasks = await getTasksForList(client, list.id);

      for (const task of tasks) {
        allTasks.push({
          ...task,
          listName: list.name,
          folderName: list.folderName,
          spaceName: list.spaceName,
          listId: list.id,
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch tasks for list '${list.name}' (id: ${list.id}): ${error.message}. Skipping.`);
    }
  }

  console.log(`Total tasks fetched across all lists: ${allTasks.length}`);
  return allTasks;
}
