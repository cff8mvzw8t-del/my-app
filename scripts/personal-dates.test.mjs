import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonalDate, displayPersonalDate, isValidPastDate, relationshipDuration, clampCalendarParts } from '../personalDates.ts';

test('calendar dates round trip without timezone conversion and reject invalid dates', () => {
  assert.equal(normalizePersonalDate('29/2/2024'), '2024-02-29');
  assert.equal(displayPersonalDate('2002-06-24'), '24/06/2002');
  for (const value of ['29/02/2023', '31/04/2025', '2025-13-01', 'not a date']) assert.equal(normalizePersonalDate(value), undefined);
  assert.equal(normalizePersonalDate(''), undefined);
  assert.equal(isValidPastDate('04/11/2026', new Date(2026, 10, 3)), false);
  assert.equal(isValidPastDate('03/11/2026', new Date(2026, 10, 3)), true);
});

test('relationship duration changes on completed calendar months and anniversaries', () => {
  const today = new Date(2026, 10, 3);
  assert.equal(relationshipDuration('2023-11-03', today), '3 שנים');
  assert.equal(relationshipDuration('2023-11-04', today), 'שנתיים ו־11 חודשים');
  assert.equal(relationshipDuration('2026-10-03', today), 'חודש');
  assert.equal(relationshipDuration('2026-11-03', today), 'מהיום');
  assert.equal(relationshipDuration('2026-11-02', today), 'יום');
  assert.equal(relationshipDuration('2027-01-01', today), 'לא צוין תאריך התחלה');
});

test('date wheels clamp short months, leap years and past-only boundaries', () => {
  assert.deepEqual(clampCalendarParts({year:2024,month:2,day:31}),{year:2024,month:2,day:29});
  assert.deepEqual(clampCalendarParts({year:2023,month:2,day:29}),{year:2023,month:2,day:28});
  assert.deepEqual(clampCalendarParts({year:2026,month:4,day:31}),{year:2026,month:4,day:30});
  assert.deepEqual(clampCalendarParts({year:2026,month:12,day:31},'2026-11-03'),{year:2026,month:11,day:3});
});
