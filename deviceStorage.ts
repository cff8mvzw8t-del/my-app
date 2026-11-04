import type { Person, GuardPost, GuardTimeSlot, GuardAssignment, RosterEntry, TaskItem, ReadinessShift } from './App';
import { normalizePersonalDate } from './personalDates';
import { isPhotoFraming } from './photoFraming';

export type TrackingKind = 'שיפור' | 'שימור';
export type TrackingEvent = { id: string; personName: string; personId: string; date: string; time: string; value: string; details: string; kind?: TrackingKind; attachments?: { kind: 'image' | 'video'; uri: string }[]; media?: { kind: 'image' | 'video'; uri: string } };

function validTrackingMedia(media: unknown): boolean {
  if (media === undefined) return true;
  if (!media || typeof media !== 'object') return false;
  const { kind, uri } = media as Record<string, unknown>;
  return (kind === 'image' || kind === 'video') && typeof uri === 'string' && uri.startsWith(`data:${kind}/`);
}

export type SavedAppData = {
  people: Person[];
  guardPosts: GuardPost[];
  guardTimeSlots: GuardTimeSlot[];
  guardAssignments: GuardAssignment[];
  readinessShifts?: ReadinessShift[];
  readinessFighterLabels?: string[];
  rosterEntries: RosterEntry[];
  absenceReasons: string[];
  baseOptions: string[];
  tasks: TaskItem[];
  trackingEvents?: TrackingEvent[];
  trackingValues?: string[];
};

export const STORAGE_KEY = 'personal-control-app:data:v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export type LoadResult = { kind: 'ready'; data?: SavedAppData } | { kind: 'error'; raw?: string; data?: SavedAppData } | { kind: 'unavailable' };
export type DatabaseStore = { read: () => Promise<string | null>; write: (raw: string) => Promise<void>; available?: () => boolean };
export const DATABASE_NAME = 'personal-control-app';
export const DATABASE_STORE = 'app-data';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const fields = (value: unknown, keys: string[]) => record(value) && keys.every((key) => typeof value[key] === 'string');
const rows = (value: unknown, check: (item: Record<string, unknown>) => boolean): value is Record<string, unknown>[] => Array.isArray(value) && value.every((item) => record(item) && check(item));
const unique = (items: Record<string, unknown>[], key: string) => new Set(items.map((item) => item[key])).size === items.length;
const optionalDate = (value: unknown) => value === undefined || (typeof value === 'string' && (value === '' || normalizePersonalDate(value) === value));

function isAppData(value: unknown): value is SavedAppData {
  if (!record(value)) return false;
  if (value.readinessFighterLabels !== undefined && (!strings(value.readinessFighterLabels) || value.readinessFighterLabels.length !== 4 || !value.readinessFighterLabels.every((label) => label.trim().length > 0 && label.length <= 30))) return false;
  if (!rows(value.people, (person) => fields(person, ['id', 'name', 'city', 'role', 'status', 'color'])
    && !!person.id && !!(person.name as string).trim() && strings(person.statusTags)
    && (person.group === undefined || ['lone', 'married', 'other'].includes(person.group as string))
    && (person.isCommander === undefined || typeof person.isCommander === 'boolean')
    && optionalDate(person.birthday)
    && (person.partner === undefined || (record(person.partner) && typeof person.partner.name === 'string' && optionalDate(person.partner.birthday) && optionalDate(person.partner.relationshipStart)))
    && (person.photoUri === undefined || typeof person.photoUri === 'string')
    && (person.photoFraming === undefined || isPhotoFraming(person.photoFraming))
    && (person.statusDetails === undefined || (record(person.statusDetails) && Object.entries(person.statusDetails).every(([key, text]) => ['medical', 'welfare', 'fitness', 'discipline', 'values'].includes(key) && typeof text === 'string'))))) return false;
  if (!rows(value.guardPosts, (post) => fields(post, ['id', 'place', 'details'])) || !unique(value.guardPosts, 'id')) return false;
  if (!rows(value.guardTimeSlots, (slot) => fields(slot, ['id', 'time'])) || !unique(value.guardTimeSlots, 'id')) return false;
  if (!unique(value.people, 'id') || !strings(value.absenceReasons) || !strings(value.baseOptions)) return false;
  const personIds = new Set(value.people.map((person) => person.id));
  const postIds = new Set(value.guardPosts.map((post) => post.id));
  const slotIds = new Set(value.guardTimeSlots.map((slot) => slot.id));
  if (value.readinessShifts !== undefined) {
    const commanders = new Set(value.people.filter((person) => person.isCommander === true).map((person) => person.id));
    if (!rows(value.readinessShifts, (shift) => {
      if (!fields(shift, ['id', 'time', 'commanderId']) || !shift.id || !strings(shift.fighterIds) || shift.fighterIds.length !== 4) return false;
      if (shift.commanderId && !commanders.has(shift.commanderId)) return false;
      if (!shift.fighterIds.every((id) => !id || (personIds.has(id) && !commanders.has(id)))) return false;
      const assigned = [...shift.fighterIds, shift.commanderId].filter(Boolean);
      return new Set(assigned).size === assigned.length;
    }) || !unique(value.readinessShifts, 'id')) return false;
  }
  if (!rows(value.guardAssignments, (assignment) => fields(assignment, ['postId', 'slotId', 'personId']) && personIds.has(assignment.personId) && postIds.has(assignment.postId) && slotIds.has(assignment.slotId))) return false;
  if (new Set(value.guardAssignments.map((item) => `${item.postId}\u0000${item.slotId}`)).size !== value.guardAssignments.length) return false;
  if (!rows(value.rosterEntries, (entry) => fields(entry, ['personId', 'attendance', 'reason', 'base']) && personIds.has(entry.personId) && ['נוכח', 'לא נוכח'].includes(entry.attendance as string)) || !unique(value.rosterEntries, 'personId')) return false;
  if (value.trackingValues !== undefined && (!Array.isArray(value.trackingValues) || !value.trackingValues.every((item) => typeof item === 'string'))) return false;
  if (value.trackingEvents !== undefined && (!rows(value.trackingEvents, (event) => fields(event, ['id', 'personName', 'personId', 'date', 'time', 'value', 'details']) && (event.kind === undefined || event.kind === 'שיפור' || event.kind === 'שימור') && validTrackingMedia(event.media) && (event.attachments === undefined || (Array.isArray(event.attachments) && event.attachments.every((media) => media !== undefined && validTrackingMedia(media))))) || !unique(value.trackingEvents, 'id'))) return false;
  return rows(value.tasks, (task) => fields(task, ['id', 'title', 'due']) && typeof task.done === 'boolean' && ['דחופה', 'רגילה'].includes(task.urgency as string) && ['חשובה', 'רגילה'].includes(task.importance as string)) && unique(value.tasks, 'id');
}

export function parseBackup(raw: string): SavedAppData {
  const envelope: unknown = JSON.parse(raw);
  if (!record(envelope) || envelope.version !== 1 || !isAppData(envelope.data)) throw new Error('Invalid or unsupported backup');
  return envelope.data;
}

export function createBackup(data: SavedAppData): string {
  return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data });
}

function browserStorage(): Store | undefined {
  return typeof window !== 'undefined' ? window.localStorage : undefined;
}

function databaseOperation(mode: 'readonly' | 'readwrite', raw?: string, key = STORAGE_KEY, remove = false): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Database unavailable')); return; }
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    let settled = false;
    const finish = (error?: unknown, value: string | null = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      database?.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      try { transaction?.abort(); } catch { /* Already completed. */ }
      finish(new Error('Storage timeout'));
    }, 8000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE_NAME, 1); } catch (error) { finish(error); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATABASE_STORE)) request.result.createObjectStore(DATABASE_STORE);
    };
    request.onerror = () => finish(request.error || new Error('Database unavailable'));
    request.onblocked = () => finish(new Error('Database blocked'));
    request.onsuccess = () => {
      database = request.result;
      if (settled) { database.close(); return; }
      try {
        transaction = database.transaction(DATABASE_STORE, mode);
        const store = transaction.objectStore(DATABASE_STORE);
        const operation = mode === 'readwrite' ? remove ? store.delete(key) : store.put(raw, key) : store.get(key);
        let result: string | null = null;
        operation.onsuccess = () => { if (mode === 'readonly') result = typeof operation.result === 'string' ? operation.result : null; };
        transaction.oncomplete = () => finish(undefined, result);
        transaction.onabort = () => finish(transaction?.error || new Error('Storage transaction failed'));
        transaction.onerror = () => finish(transaction?.error || new Error('Storage transaction failed'));
      } catch (error) { finish(error); }
    };
  });
}

const browserDatabase: DatabaseStore = {
  available: () => typeof indexedDB !== 'undefined',
  read: () => databaseOperation('readonly'),
  write: async (raw) => { await databaseOperation('readwrite', raw); },
};

let lastSaveTime = 0;
let saveQueue: Promise<void> = Promise.resolve();

export async function loadDeviceData(getStore: () => Store | undefined = browserStorage, database: DatabaseStore = browserDatabase): Promise<LoadResult> {
  let localRaw: string | null = null;
  let localAvailable = false;
  let databaseAvailable = false;
  let databaseRaw: string | null = null;
  try { const store = getStore(); if (store) { localRaw = store.getItem(STORAGE_KEY); localAvailable = true; } } catch { /* Try the database. */ }
  try { databaseRaw = await database.read(); databaseAvailable = true; } catch { /* Keep legacy storage usable. */ }
  const valid: { data: SavedAppData; savedAt: number; generation: number; database: boolean }[] = [];
  let invalidRaw: string | undefined;
  for (const [raw, fromDatabase] of [[localRaw, false], [databaseRaw, true]] as const) {
    if (raw === null) continue;
    try {
      const data = parseBackup(raw);
      const envelope = JSON.parse(raw);
      const date = Date.parse(envelope.savedAt);
      valid.push({ data, savedAt: Number.isFinite(date) ? date : 0, generation: envelope.persistence === 2 ? 2 : 0, database: fromDatabase });
    } catch { invalidRaw = raw; }
  }
  if (!databaseAvailable && database.available?.() !== false) {
    // An unreadable database is not an empty database: do not auto-save an old
    // legacy mirror over a potentially newer collection when it recovers.
    if (localAvailable) return { kind: 'error', raw: localRaw ?? undefined, data: valid[0]?.data };
    return { kind: 'unavailable' };
  }
  valid.sort((a, b) => b.generation - a.generation || b.savedAt - a.savedAt || Number(b.database) - Number(a.database));
  if (invalidRaw !== undefined) return { kind: 'error', raw: invalidRaw, data: valid[0]?.data };
  if (valid.length) {
    lastSaveTime = Math.max(lastSaveTime, valid[0].savedAt);
    return { kind: 'ready', data: valid[0].data };
  }
  // Never replace malformed saved records with seed data.
  if (localAvailable || databaseAvailable) return { kind: 'ready' };
  return { kind: 'unavailable' };
}

export function storageErrorMessage(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'QuotaExceededError') return 'אין מספיק שטח פנוי לשמירה במכשיר. הורד גיבוי של המידע לפני סגירה.';
  if (name === 'SecurityError' || name === 'NotAllowedError') return 'הדפדפן חוסם שמירה במכשיר. הורד גיבוי לפני סגירה ובדוק שאינך בגלישה פרטית.';
  return 'השמירה במכשיר לא הושלמה. הורד גיבוי לפני סגירה ונסה שוב.';
}

export async function checkDeviceStorage(): Promise<void> {
  const key = `${STORAGE_KEY}:check:${Date.now()}`;
  const value = 'storage-check';
  try {
    await databaseOperation('readwrite', value, key);
    if (await databaseOperation('readonly', undefined, key) !== value) throw new Error('Storage verification failed');
  } finally {
    await databaseOperation('readwrite', undefined, key, true).catch(() => {});
  }
}

export function saveDeviceData(data: SavedAppData, getStore: () => Store | undefined = browserStorage, database: DatabaseStore = browserDatabase): Promise<void> {
  // Snapshot immediately, then serialize writes so a slow earlier save cannot
  // overwrite a newer edit or a confirmed restore.
  lastSaveTime = Math.max(Date.now(), lastSaveTime + 1);
  const raw = JSON.stringify({ version: 1, persistence: 2, savedAt: new Date(lastSaveTime).toISOString(), data });
  const write = async () => {
    let databaseSaved = false;
    let localSaved = false;
    let databaseError: unknown;
    let localError: unknown;
    try { await database.write(raw); databaseSaved = true; } catch (error) { databaseError = error; }
    // Small snapshots also retain a legacy mirror. Large photo collections go
    // to IndexedDB, without being constrained by localStorage's small quota.
    if (!databaseSaved || raw.length <= 1000000) {
      try {
        const store = getStore();
        if (!store) throw new Error('Device storage unavailable');
        store.setItem(STORAGE_KEY, raw);
        localSaved = true;
      } catch (error) { localError = error; }
    }
    if (!databaseSaved && !localSaved) throw localError || databaseError || new Error('Device storage unavailable');
  };
  const result = saveQueue.then(write);
  saveQueue = result.catch(() => {});
  return result;
}
