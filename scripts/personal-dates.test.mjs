import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonalDate, displayPersonalDate, isValidPastDate, relationshipDuration } from '../personalDates.ts';

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
