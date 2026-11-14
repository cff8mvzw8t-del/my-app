import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScriptForTests } from './load-ts-for-tests.mjs';

const { parseLeaveRequest, normalizeRequestDate, normalizeRequestTime, displayRequestDate } = loadTypeScriptForTests(new URL('../personRecords.ts', import.meta.url));
const { createBackup, parseBackup } = loadTypeScriptForTests(new URL('../deviceStorage.ts', import.meta.url));

test('WhatsApp request preserves descriptive departure and return times', () => {
  const request = parseLeaveRequest(`תאריך יציאה: 22/11/2026
שעת יציאה: בוקר

תאריך חזרה: 23/11/2026
שעת חזרה: אחר הצהריים

סיבת הבקשה: אירוע לדוגמה

דרכי יציאה: תחב״צ
דרכי חזרה: תחב״צ
רמת חשיבות:9`);
  assert.equal(normalizeRequestDate(request.departureDate), '2026-11-22');
  assert.equal(normalizeRequestDate(request.returnDate), '2026-11-23');
  assert.equal(normalizeRequestTime(request.departureTime), 'בוקר');
  assert.equal(normalizeRequestTime(request.returnTime), 'אחר הצהריים');

  const data = {
    people: [{ id: 'p1', name: 'אדם בדיקה', city: '', role: '', status: '', color: '#000000', statusTags: [],
      leaveRequests: [{ ...request, id: 'leave1', status: 'ממתין', departureDate: '2026-11-22', returnDate: '2026-11-23' }] }],
    guardPosts: [], guardTimeSlots: [], guardAssignments: [], rosterEntries: [], absenceReasons: [], baseOptions: [], tasks: [],
  };
  assert.deepEqual(parseBackup(createBackup(data)), data);
  data.people[0].leaveRequests[0].forwardedToCommander = true;
  assert.deepEqual(parseBackup(createBackup(data)), data);
  data.people[0].leaveRequests[0].returnTime = 'הכי מוקדם שאוכל בערך בערב';
  assert.deepEqual(parseBackup(createBackup(data)), data);
});

test('numeric times remain canonical and invalid times are rejected', () => {
  assert.equal(normalizeRequestTime('6:00'), '06:00');
  assert.equal(normalizeRequestTime('23:59'), '23:59');
  assert.equal(normalizeRequestTime('24:00'), undefined);
  assert.equal(normalizeRequestTime('09:75'), undefined);
  assert.equal(normalizeRequestTime(''), undefined);
  assert.equal(normalizeRequestTime('unknown'), undefined);
});

test('copied Hebrew descriptions tolerate direction marks and repeated spaces', () => {
  assert.equal(normalizeRequestTime('\u200f אחר   הצהריים \u200e'), 'אחר הצהריים');
  assert.equal(normalizeRequestTime('אחה״צ'), 'אחה״צ');
});

test('request summaries derive the weekday from the calendar date', () => {
  assert.equal(displayRequestDate('2026-11-22'), 'יום ראשון · 22/11/2026');
  assert.equal(displayRequestDate('23/11/2026'), 'יום שני · 23/11/2026');
  assert.equal(displayRequestDate('1.1.27'), 'יום שישי · 01/01/2027');
  assert.equal(displayRequestDate('invalid'), 'invalid');
});

test('request dates accept common separators and default the missing year', () => {
  for (const value of ['17.11', '17/11', '17\\11', '17-11', ' 17 . 11 ', '\u200f17/11\u200e']) {
    assert.equal(normalizeRequestDate(value, 2026), '2026-11-17');
  }
  for (const value of ['17.11.27', '17/11/2027', '17\\11\\27', '17-11-2027', '2027-11-17']) {
    assert.equal(normalizeRequestDate(value, 2026), '2027-11-17');
  }
  assert.equal(normalizeRequestDate('31.11', 2026), undefined);
  assert.equal(normalizeRequestDate('29/2', 2026), undefined);
  assert.equal(normalizeRequestDate('29/2', 2028), '2028-02-29');
  assert.equal(normalizeRequestDate('17/13', 2026), undefined);
});

test('free-text request fields accept dates within sentences and Hebrew time descriptions', () => {
  assert.equal(normalizeRequestDate('17.11 יום שלישי מאוחר', 2026), '2026-11-17');
  assert.equal(normalizeRequestDate('ביום שני 16/11 בבוקר', 2026), '2026-11-16');
  assert.equal(normalizeRequestDate('ביום שלישי 2026-11-17 מאוחר', 2026), '2026-11-17');
  assert.equal(normalizeRequestTime('הכי מוקדם שאוכל בערך בערב'), 'הכי מוקדם שאוכל בערך בערב');
  assert.equal(normalizeRequestTime('בסביבות 6 בערב'), 'בסביבות 6 בערב');
  assert.equal(normalizeRequestTime('בערך ב־18:30'), 'בערך ב־18:30');
  assert.equal(normalizeRequestTime('בערך ב־25:99'), undefined);
  assert.equal(normalizeRequestDate('31.11 יום שלישי', 2026), undefined);
  assert.equal(normalizeRequestDate('17.11 או 18.11', 2026), undefined);
  assert.equal(normalizeRequestDate('17/11/20267', 2026), undefined);
});
