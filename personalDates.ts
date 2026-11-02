/** Calendar dates only: storage is ISO, the Hebrew form accepts DD/MM/YYYY. */
export function normalizePersonalDate(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!iso && !local) return undefined;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(local![3]), Number(local![2]), Number(local![1])];
  const date = new Date(year, month - 1, day);
  if (year < 1000 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function displayPersonalDate(value?: string): string {
  const normalized = normalizePersonalDate(value);
  if (!normalized) return value ?? '';
  return normalized.split('-').reverse().join('/');
}

export function isValidPastDate(value?: string, today = new Date()): boolean {
  if (!value?.trim()) return true;
  const normalized = normalizePersonalDate(value);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return !!normalized && normalized <= todayKey;
}

export function relationshipDuration(value?: string, today = new Date()): string {
  const start = normalizePersonalDate(value);
  if (!start || !isValidPastDate(start, today)) return 'לא צוין תאריך התחלה';
  const [year, month, day] = start.split('-').map(Number);
  let months = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
  if (today.getDate() < day) months--;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [];
  if (years) parts.push(years === 1 ? 'שנה' : years === 2 ? 'שנתיים' : `${years} שנים`);
  if (remainingMonths) parts.push(remainingMonths === 1 ? 'חודש' : remainingMonths === 2 ? 'חודשיים' : `${remainingMonths} חודשים`);
  if (parts.length) return parts.join(' ו־');
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
  return days === 0 ? 'מהיום' : days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`;
}
