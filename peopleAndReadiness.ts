import type { Person, ReadinessShift } from './App';

export const personGroups = [
  { key: 'lone', label: 'חיילים בודדים' },
  { key: 'married', label: 'נשואים' },
  { key: 'other', label: 'השאר' },
] as const;

export const normalizedPersonName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function getReadinessCandidates(people: Person[], shift: ReadinessShift, role: 'fighter' | 'commander', fighterIndex?: number): Person[] {
  const used = new Set([...shift.fighterIds.filter((_, index) => role !== 'fighter' || index !== fighterIndex), role === 'commander' ? '' : shift.commanderId].filter(Boolean));
  return people.filter((person) => (role === 'commander' ? !!person.isCommander : !person.isCommander) && !used.has(person.id));
}

export function assignReadinessPerson(shift: ReadinessShift, people: Person[], role: 'fighter' | 'commander', fighterIndex: number | undefined, personId: string): ReadinessShift {
  if (role === 'fighter' && (fighterIndex === undefined || fighterIndex < 0 || fighterIndex > 3 || !Number.isInteger(fighterIndex))) return shift;
  if (personId && !getReadinessCandidates(people, shift, role, fighterIndex).some((person) => person.id === personId)) return shift;
  return role === 'commander' ? { ...shift, commanderId: personId } : { ...shift, fighterIds: shift.fighterIds.map((id, index) => index === fighterIndex ? personId : id) };
}

export function reconcileReadinessPeople(shifts: ReadinessShift[], people: Person[]): ReadinessShift[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  return shifts.map((shift) => {
    const commanderId = byId.get(shift.commanderId)?.isCommander ? shift.commanderId : '';
    const used = new Set([commanderId]);
    const fighterIds = Array.from({ length: 4 }, (_, index) => {
      const id = shift.fighterIds[index] ?? '';
      const person = byId.get(id);
      if (!person || person.isCommander || used.has(id)) return '';
      used.add(id);
      return id;
    });
    return { ...shift, commanderId, fighterIds };
  });
}
