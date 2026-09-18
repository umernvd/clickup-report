import { sleep } from '../utils/sleep.js';

export function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const startDate = monday.getTime();
  const endDate = sunday.getTime();

  return { startDate, endDate };
}

export async function getWorkspaceMembers(client, teamId) {
  const response = await client.get('/team');
  const teams = response.data?.teams ?? [];
  const team = teams.find((t) => String(t.id) === String(teamId));

  if (!team) {
    throw new Error(`Workspace ${teamId} not found`);
  }

  return (team.members ?? [])
    .map((m) => m.user)
    .filter((u) => u && u.id != null);
}

export async function getTimeEntries(client, teamId, startDate, endDate) {
  const members = await getWorkspaceMembers(client, teamId);
  const userIds = members.map((m) => m.id);

  if (userIds.length === 0) {
    console.log('Time entries: 0 (no workspace members)');
    return [];
  }

  const userById = new Map(members.map((m) => [String(m.id), m]));
  let entries = [];

  try {
    const response = await client.get(`/team/${teamId}/time_entries`, {
      params: {
        start_date: startDate,
        end_date: endDate,
        assignee: userIds.join(','),
      },
    });
    entries = response.data?.data ?? [];
  } catch (error) {
    const status = error.response?.status;
    if (status === 400 || status === 403) {
      entries = await fetchPerUser(client, teamId, startDate, endDate, userIds);
    } else {
      throw error;
    }
  }

  const parsed = entries
    .map((entry) => ({
      ...entry,
      duration: parseInt(entry.duration, 10),
      user: entry.user ?? null,
    }))
    .filter((entry) => entry.duration > 0);

  console.log(`Time entries: ${parsed.length}`);
  return parsed;
}

async function fetchPerUser(client, teamId, startDate, endDate, userIds) {
  const all = [];
  for (const userId of userIds) {
    const response = await client.get(`/team/${teamId}/time_entries`, {
      params: {
        start_date: startDate,
        end_date: endDate,
        assignee: userId,
      },
    });
    all.push(...(response.data?.data ?? []));
    await sleep(250);
  }
  return all;
}
