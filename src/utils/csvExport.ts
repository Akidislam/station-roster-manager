import { Member, Station, Weekday, WEEKDAYS, WeekSchedule } from '../types';
import { getWeekDates } from './storage';

/**
 * Generates an RFC-4180 compliant CSV string for a week's roster.
 * Columns: Station Name, Date, Weekday, Status, Assigned Members, Member Count
 */
export function exportRosterToCSV(
  schedule: WeekSchedule,
  stations: Station[],
  members: Member[]
): string {
  const dates = getWeekDates(schedule.startDate);

  // Group members by station
  const stationMembers: Record<string, string[]> = {};
  for (const s of stations) {
    stationMembers[s.id] = members
      .filter((m) => m.stationId === s.id)
      .map((m) => m.name);
  }

  const rows: string[][] = [
    ['Station Name', 'Date', 'Weekday', 'Status', 'Closure Day', 'Assigned Members', 'Member Count']
  ];

  for (const s of stations) {
    const assignedNames = stationMembers[s.id] || [];
    const membersString = assignedNames.length > 0 ? assignedNames.join('; ') : 'No members assigned';

    for (const day of WEEKDAYS) {
      const isClosed = schedule.assignments[day]?.[s.id] === true;
      const dateStr = dates[day] || '';
      const status = isClosed ? 'CLOSED' : 'OPEN';
      const closureDay = isClosed ? 'YES (Holiday)' : 'NO (Operating)';

      rows.push([
        s.name,
        dateStr,
        day,
        status,
        closureDay,
        membersString,
        assignedNames.length.toString(),
      ]);
    }
  }

  // Format into CSV escaping quotes
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = (cell ?? '').toString();
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\r\n');

  return csvContent;
}

/**
 * Triggers a client-side download of a generated text/csv file.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
