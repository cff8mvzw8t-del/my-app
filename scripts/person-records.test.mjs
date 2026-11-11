import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScriptForTests } from './load-ts-for-tests.mjs';

const { parseLeaveRequest, normalizeRequestDate, normalizeRequestTime } = loadTypeScriptForTests(new URL('../personRecords.ts', import.meta.url));
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
