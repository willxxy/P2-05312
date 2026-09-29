import type { DateOption, Expense, Plan } from './types';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
export const parseDate = (date: string) => new Date(`${date}T12:00:00`);
export const shortName = (name: string) => name.split(' ')[0];
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

export function dateLabel(date?: DateOption) {
  if (!date) return 'Finding our dates';
  if (date.start === date.end) return dateFormat.format(parseDate(date.start));
  const start = parseDate(date.start);
  const end = parseDate(date.end);
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${dateFormat.format(start)}–${end.getDate()}`;
  }
  return `${dateFormat.format(start)} – ${dateFormat.format(end)}`;
}

export function planStatus(plan: Plan) {
  if (!plan.lockedDateId)
    return plan.dates.length ? 'Picking a date' : 'Just an idea';
  const date = plan.dates.find((item) => item.id === plan.lockedDateId);
  const today = new Date();
  const localDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (date && date.end < localDay) return 'Good memories';
  if (date && date.start <= localDay && date.end >= localDay)
    return 'Happening now';
  return plan.members.filter((member) => member.rsvp === 'going').length >=
    plan.minGoing
    ? 'It’s happening'
    : 'Date locked';
}

export function shareAmount(expense: Expense, userId: string) {
  const index = expense.participants.indexOf(userId);
  if (index < 0) return 0;
  const base = Math.floor(expense.amount / expense.participants.length);
  const remainder = expense.amount % expense.participants.length;
  return base + (index < remainder ? 1 : 0);
}

export function downloadCalendar(plan: Plan) {
  const date = plan.dates.find((item) => item.id === plan.lockedDateId);
  if (!date) return;
  const nextDay = parseDate(date.end);
  nextDay.setDate(nextDay.getDate() + 1);
  const end = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
  const escape = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gather//Plans//EN',
    'BEGIN:VEVENT',
    `UID:${plan.id}@gather.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date.start.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escape(plan.name)}`,
    `LOCATION:${escape(plan.address || plan.location)}`,
    `DESCRIPTION:${escape(plan.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n') + '\r\n'], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${plan.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
