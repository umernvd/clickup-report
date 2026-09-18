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

export async function getTimeEntries(client, teamId, startDate, endDate) {
  const response = await client.get(`/team/${teamId}/time_entries`, {
    params: { start_date: startDate, end_date: endDate },
  });

  const entries = (response.data?.data ?? []).map((entry) => ({
    ...entry,
    duration: parseInt(entry.duration, 10),
  }));

  console.log(`Time entries: ${entries.length}`);
  return entries;
}
