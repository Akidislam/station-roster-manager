import ExcelJS from 'exceljs';
import { MonthlyRoster } from '../types';
import { triggerFileDownload } from './csvExport';

/**
 * Sanitizes a string to prevent spreadsheet formula injection attacks (CSV Injection).
 * If a field starts with '=', '+', '-', or '@', prepend a single quote so spreadsheets
 * treat it strictly as literal text.
 */
export function sanitizeCsvField(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // If starts with formula triggers, prepend a single quote
  if (/^[=\+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // RFC-4180 CSV escaping
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string for the monthly roster.
 * Prepend with UTF-8 Byte Order Mark (\uFEFF) to guarantee correct rendering of
 * Unicode characters (including Bangla, accented Latin, etc.) in Excel and Google Sheets.
 */
export function exportMonthlyRosterToCSV(roster: MonthlyRoster): string {
  const lines: string[] = [];

  // Metadata headers
  lines.push(
    `# Station Roster - ${roster.monthName} ${roster.year}`
  );
  lines.push(
    `# Total Stations: ${roster.stations.length} | Generated: ${new Date(roster.generatedAt).toISOString().split('T')[0]}`
  );
  lines.push('');

  // Column headers
  const headerCols = [
    'Date',
    'Day Number',
    'Weekday',
    'Weekend',
    'Station Name',
    'Working Hours',
    'Break Time',
    'Status',
    'Assigned Members',
    'Member Count',
  ];
  lines.push(headerCols.map(sanitizeCsvField).join(','));

  // Data rows
  for (const day of roster.days) {
    for (const station of roster.stations) {
      const status = day.stations[station.id];
      const isClosed = status?.isClosed ?? false;
      const assigned = status?.assignedMembers ?? [];
      const assignedNames =
        assigned.length > 0 ? assigned.map((m) => m.name).join('; ') : 'No staff assigned';

      const row = [
        day.formattedDate,
        day.dayNumber.toString(),
        day.weekday,
        day.isWeekend ? 'YES' : 'NO',
        station.name,
        station.workingHours || '08:00 - 17:00',
        station.breakTime || '13:00 - 14:00',
        isClosed ? 'CLOSED (Holiday)' : 'OPEN',
        assignedNames,
        assigned.length.toString(),
      ];

      lines.push(row.map(sanitizeCsvField).join(','));
    }
  }

  // Prepend UTF-8 BOM so Excel & Google Sheets open Unicode seamlessly
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates a professionally styled Microsoft Excel (.xlsx) workbook
 * formatted to look like a reference Google Sheets operational roster.
 */
export async function generateMonthlyExcelWorkbook(roster: MonthlyRoster): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Station Roster Manager';
  workbook.lastModifiedBy = 'Station Roster Manager';
  workbook.created = new Date(roster.generatedAt);
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(`${roster.monthName} ${roster.year}`, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      showGridLines: true,
    },
    views: [
      {
        state: 'frozen',
        xSplit: 2, // Freeze Date & Day columns
        ySplit: 5, // Freeze top 5 header rows
      },
    ],
  });

  const numStations = roster.stations.length;
  const totalCols = 2 + numStations * 2; // Date, Day, then 2 cols (Status, Members) per station

  // Palette definitions
  const TITLE_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E1B4B' }, // Deep Indigo 950
  };
  const SUBTITLE_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' }, // Indigo 900
  };
  const STATION_HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3730A3' }, // Indigo 800
  };
  const HOURS_HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // Slate 100
  };
  const COL_HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }, // Slate 200
  };

  const OPEN_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }, // Soft Green 50
  };
  const CLOSED_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE0B2' }, // Warm Orange 100
  };
  const WEEKEND_DATE_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF3E0' }, // Orange 50
  };

  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // Row 1: Title Banner
  const titleRow = sheet.getRow(1);
  titleRow.height = 36;
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `MONTHLY STATION OPERATIONAL ROSTER — ${roster.monthName.toUpperCase()} ${roster.year}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = TITLE_FILL;

  // Row 2: Subtitle & Operational Constraints
  const subRow = sheet.getRow(2);
  subRow.height = 22;
  sheet.mergeCells(2, 1, 2, totalCols);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Policy: ${roster.policy.closuresPerStation} Days Off/Station/Week • Min Open Stations: ${
    roster.policy.minOpenStationsPerDay
  } • Total Stations: ${numStations} • Reference Google Sheets Format`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFE0E7FF' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = SUBTITLE_FILL;

  // Row 3: Station Names Header (Merged per station)
  const stationRow = sheet.getRow(3);
  stationRow.height = 28;

  // Date & Day header labels (spans Row 3 & 4)
  sheet.mergeCells(3, 1, 4, 1);
  const dateHeader = sheet.getCell(3, 1);
  dateHeader.value = 'DATE';
  dateHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  dateHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  dateHeader.fill = STATION_HEADER_FILL;
  dateHeader.border = THIN_BORDER;

  sheet.mergeCells(3, 2, 4, 2);
  const dayHeader = sheet.getCell(3, 2);
  dayHeader.value = 'DAY';
  dayHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  dayHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  dayHeader.fill = STATION_HEADER_FILL;
  dayHeader.border = THIN_BORDER;

  // Stations
  roster.stations.forEach((st, idx) => {
    const colStart = 3 + idx * 2;
    const colEnd = colStart + 1;
    sheet.mergeCells(3, colStart, 3, colEnd);
    const cell = sheet.getCell(3, colStart);
    cell.value = st.name.toUpperCase();
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = STATION_HEADER_FILL;
    cell.border = THIN_BORDER;
    sheet.getCell(3, colEnd).border = THIN_BORDER;
  });

  // Row 4: Working Hours & Break Times
  const hoursRow = sheet.getRow(4);
  hoursRow.height = 20;
  roster.stations.forEach((st, idx) => {
    const colStart = 3 + idx * 2;
    const colEnd = colStart + 1;
    sheet.mergeCells(4, colStart, 4, colEnd);
    const cell = sheet.getCell(4, colStart);
    const hours = st.workingHours || '08:00 - 17:00';
    const breaks = st.breakTime || '13:00 - 14:00';
    cell.value = `Hours: ${hours}  |  Break: ${breaks}`;
    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF334155' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = HOURS_HEADER_FILL;
    cell.border = THIN_BORDER;
    sheet.getCell(4, colEnd).border = THIN_BORDER;
  });

  // Row 5: Column Subheaders (Status / Assigned Personnel)
  const subheadRow = sheet.getRow(5);
  subheadRow.height = 22;

  const dateSub = sheet.getCell(5, 1);
  dateSub.value = 'DD-Mon-YYYY';
  dateSub.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
  dateSub.alignment = { horizontal: 'center', vertical: 'middle' };
  dateSub.fill = COL_HEADER_FILL;
  dateSub.border = THIN_BORDER;

  const daySub = sheet.getCell(5, 2);
  daySub.value = 'Day of Week';
  daySub.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
  daySub.alignment = { horizontal: 'center', vertical: 'middle' };
  daySub.fill = COL_HEADER_FILL;
  daySub.border = THIN_BORDER;

  roster.stations.forEach((_st, idx) => {
    const col1 = 3 + idx * 2;
    const col2 = col1 + 1;

    const c1 = sheet.getCell(5, col1);
    c1.value = 'STATUS';
    c1.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.fill = COL_HEADER_FILL;
    c1.border = THIN_BORDER;

    const c2 = sheet.getCell(5, col2);
    c2.value = 'ASSIGNED PERSONNEL';
    c2.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
    c2.alignment = { horizontal: 'left', vertical: 'middle' };
    c2.fill = COL_HEADER_FILL;
    c2.border = THIN_BORDER;
  });

  // Set explicit column widths
  sheet.getColumn(1).width = 14; // Date
  sheet.getColumn(2).width = 13; // Day
  roster.stations.forEach((_st, idx) => {
    sheet.getColumn(3 + idx * 2).width = 11; // Status (OPEN/CLOSED)
    sheet.getColumn(4 + idx * 2).width = 28; // Assigned Personnel
  });

  // Data Rows: Days 1 to N
  let currentRowIdx = 6;
  for (const day of roster.days) {
    const row = sheet.getRow(currentRowIdx);
    row.height = 24;

    // Date Cell
    const dateCell = sheet.getCell(currentRowIdx, 1);
    dateCell.value = day.formattedDate;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { name: 'Arial', size: 9, bold: day.isWeekend };
    dateCell.border = THIN_BORDER;
    dateCell.fill = day.isWeekend ? WEEKEND_DATE_FILL : { type: 'pattern', pattern: 'none' };

    // Weekday Cell
    const dayCell = sheet.getCell(currentRowIdx, 2);
    dayCell.value = day.weekday;
    dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dayCell.font = {
      name: 'Arial',
      size: 9,
      bold: day.isWeekend,
      color: day.isWeekend ? { argb: 'FF9A3412' } : { argb: 'FF334155' },
    };
    dayCell.border = THIN_BORDER;
    dayCell.fill = day.isWeekend ? WEEKEND_DATE_FILL : { type: 'pattern', pattern: 'none' };

    // Stations Data
    roster.stations.forEach((st, idx) => {
      const colStatus = 3 + idx * 2;
      const colMembers = colStatus + 1;

      const stStatus = day.stations[st.id];
      const isClosed = stStatus?.isClosed ?? false;
      const assigned = stStatus?.assignedMembers ?? [];
      const assignedText =
        assigned.length > 0 ? assigned.map((m) => m.name).join(', ') : '—';

      const statusCell = sheet.getCell(currentRowIdx, colStatus);
      statusCell.border = THIN_BORDER;
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const membersCell = sheet.getCell(currentRowIdx, colMembers);
      membersCell.border = THIN_BORDER;
      membersCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      if (isClosed) {
        // Closed / Weekend highlight (Warm Orange fill)
        statusCell.value = 'CLOSED';
        statusCell.fill = CLOSED_FILL;
        statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFBF360C' } };

        membersCell.value = `${assignedText} (OFF)`;
        membersCell.fill = CLOSED_FILL;
        membersCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF9A3412' } };
      } else {
        // Operating Day highlight (Readable Green fill)
        statusCell.value = 'OPEN';
        statusCell.fill = OPEN_FILL;
        statusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1B5E20' } };

        membersCell.value = assignedText;
        membersCell.fill = OPEN_FILL;
        membersCell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
      }
    });

    currentRowIdx++;
  }

  // Summary Row: Total Operating & Closure Days
  const summaryRow = sheet.getRow(currentRowIdx);
  summaryRow.height = 24;
  sheet.mergeCells(currentRowIdx, 1, currentRowIdx, 2);
  const sumLabel = sheet.getCell(currentRowIdx, 1);
  sumLabel.value = 'TOTAL OPEN / CLOSED DAYS';
  sumLabel.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
  sumLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  sumLabel.fill = COL_HEADER_FILL;
  sumLabel.border = THIN_BORDER;
  sheet.getCell(currentRowIdx, 2).border = THIN_BORDER;

  roster.stations.forEach((st, idx) => {
    const colStatus = 3 + idx * 2;
    const colMembers = colStatus + 1;

    let openDaysCount = 0;
    let closedDaysCount = 0;

    for (const d of roster.days) {
      if (d.stations[st.id]?.isClosed) {
        closedDaysCount++;
      } else {
        openDaysCount++;
      }
    }

    sheet.mergeCells(currentRowIdx, colStatus, currentRowIdx, colMembers);
    const sumCell = sheet.getCell(currentRowIdx, colStatus);
    sumCell.value = `${openDaysCount} Open  /  ${closedDaysCount} Closed`;
    sumCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    sumCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sumCell.fill = COL_HEADER_FILL;
    sumCell.border = THIN_BORDER;
    sheet.getCell(currentRowIdx, colMembers).border = THIN_BORDER;
  });

  return workbook;
}

/**
 * Triggers a client-side Excel (.xlsx) file download using ExcelJS.
 */
export async function downloadMonthlyExcel(roster: MonthlyRoster): Promise<void> {
  const workbook = await generateMonthlyExcelWorkbook(roster);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Station-Roster-${roster.monthName}-${roster.year}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a client-side CSV (.csv) file download.
 */
export function downloadMonthlyCSV(roster: MonthlyRoster): void {
  const csvContent = exportMonthlyRosterToCSV(roster);
  triggerFileDownload(
    csvContent,
    `Station-Roster-${roster.monthName}-${roster.year}.csv`,
    'text/csv;charset=utf-8;'
  );
}
