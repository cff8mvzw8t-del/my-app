import { displayPersonalDate, normalizePersonalDate } from './personalDates';

export const requestFields = [
  ['departureDate', 'תאריך יציאה'],
  ['departureTime', 'שעת יציאה'],
  ['returnDate', 'תאריך חזרה'],
  ['returnTime', 'שעת חזרה'],
  ['reason', 'סיבת הבקשה'],
  ['departureTravel', 'דרכי יציאה'],
  ['returnTravel', 'דרכי חזרה'],
  ['importance', 'רמת חשיבות'],
] as const;

export type RequestFields = Record<typeof requestFields[number][0], string>;
export const requestStatuses = ['ממתין', 'אושר', 'נדחה'] as const;
export type LeaveRequest = RequestFields & { id: string; status: typeof requestStatuses[number]; forwardedToCommander?: boolean };
export type HomeVisit = { id: string; date: string; summary: string; followUp: string };

export function parseLeaveRequest(message: string): RequestFields {
  const draft: RequestFields = { departureDate: '', departureTime: '', returnDate: '', returnTime: '', reason: '', departureTravel: '', returnTravel: '', importance: '' };
  let field: keyof RequestFields | undefined;
  for (const line of message.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').split(/\r?\n/)) {
    const heading = /^\s*\*?([^:*]+)\*?\s*:\s*\*?\s*(.*)$/.exec(line);
    const match = heading && requestFields.find(([, label]) => label === heading[1].trim());
    if (match && heading) {
      field = match[0];
      draft[field] = heading[2].replace(/\*$/, '').trim();
    } else if (field) {
      draft[field] += '\n' + line.trim();
    }
  }
  for (const [key] of requestFields) draft[key] = draft[key].trim();
  return draft;
}

export function normalizeRequestDate(value: string, defaultYear = new Date().getFullYear()) {
  const text = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const match = /^(\d{1,2})\s*[.\/\\-]\s*(\d{1,2})(?:\s*[.\/\\-]\s*(\d{2}|\d{4}))?$/.exec(text);
  if (!match) return normalizePersonalDate(text);
  const [, day, month, year] = match;
  const fullYear = year ? (year.length === 2 ? '20' + year : year) : String(defaultYear);
  return normalizePersonalDate(`${day}/${month}/${fullYear}`);
}

export function displayRequestDate(value: string) {
  const normalized = normalizeRequestDate(value);
  if (!normalized) return value;
  const [year, month, day] = normalized.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
  return `${weekday} · ${displayPersonalDate(normalized)}`;
}

export function normalizeRequestTime(value: string) {
  const text = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().replace(/\s+/g, ' ');
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  if (match && Number(match[1]) < 24) return match[1].padStart(2, '0') + ':' + match[2];
  if (/^(?:בוקר|בבוקר|שעות הבוקר|לפנות בוקר|צהריים|בצהריים|שעות הצהריים|אחר הצהריים|אחרי הצהריים|אחה[״"]?צ|ערב|בערב|שעות הערב|לילה|בלילה|שעות הלילה)$/.test(text)) return text;
  return undefined;
}
