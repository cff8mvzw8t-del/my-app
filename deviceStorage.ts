import type { Person, GuardPost, GuardTimeSlot, GuardAssignment, RosterEntry, TaskItem, ReadinessShift } from './App';
import { normalizePersonalDate } from './personalDates';

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
};

export const STORAGE_KEY = 'personal-control-app:data:v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { kind: 'ready'; data?: SavedAppData } | { kind: 'error'; raw?: string } | { kind: 'unavailable' };

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

export function loadDeviceData(getStore: () => Store | undefined = browserStorage): LoadResult {
  let raw: string | null = null;
  try {
    const store = getStore();
    if (!store) return { kind: 'unavailable' };
    raw = store.getItem(STORAGE_KEY);
    return raw === null ? { kind: 'ready' } : { kind: 'ready', data: parseBackup(raw) };
  } catch {
    // Keep the original bytes untouched when loading or validating fails.
    return { kind: 'error', raw: raw ?? undefined };
  }
}

export function saveDeviceData(data: SavedAppData, getStore: () => Store | undefined = browserStorage): void {
  const store = getStore();
  if (!store) throw new Error('Device storage unavailable');
  store.setItem(STORAGE_KEY, createBackup(data));
}
