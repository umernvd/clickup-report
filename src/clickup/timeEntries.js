export function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  // Calculate days back to Monday (day 1). Sunday (0) goes back 6 days.
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  // Sunday is 6 days after Monday
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const startDate = monday.getTime();
  const endDate = sunday.getTime();

  console.log(`Current week start (Monday): ${monday.toISOString()}`);
  console.log(`Current week end (Sunday): ${sunday.toISOString()}`);

  return { startDate, endDate };
}

export async function getTimeEntries(client, teamId, startDate, endDate) {
  const response = await client.get(`/team/${teamId}/time_entries`, {
    params: { start_date: startDate, end_date: endDate },
  });

  // ClickUp returns duration as a string, not a number — parse it
  const entries = (response.data?.data ?? []).map((entry) => ({
    ...entry,
    duration: parseInt(entry.duration, 10),
  }));

  console.log(`Total time entries returned: ${entries.length}`);
  return entries;
}
