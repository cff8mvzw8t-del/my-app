import type { Person } from './App';
import { normalizedPersonName } from './peopleAndReadiness';

type QuestionKind = 'name' | 'face' | 'surname' | 'city';

export type QuizQuestion = {
  kind: QuestionKind;
  person: Person;
  answer: string;
  options: { value: string; photo?: Person }[];
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function choices(answer: string, alternatives: string[]) {
  const seen = new Set([normalizedPersonName(answer)]);
  const distinct = shuffle(alternatives).filter((value) => {
    const key = normalizedPersonName(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return shuffle([answer, ...distinct.slice(0, 3)]).map((value) => ({ value }));
}

export function makePeopleQuiz(people: Person[]): QuizQuestion[] {
  const pools: Record<QuestionKind, QuizQuestion[]> = { name: [], face: [], surname: [], city: [] };
  const photoCounts = new Map<string, number>();
  for (const { photoUri } of people) {
    if (photoUri) photoCounts.set(photoUri, (photoCounts.get(photoUri) ?? 0) + 1);
  }
  const portraits = people.filter(({ photoUri }) => photoUri && !photoUri.startsWith('blob:') && photoCounts.get(photoUri) === 1);
  const portraitIds = new Set(portraits.map(({ id }) => id));
  const names = people.map(({ name }) => name.trim());
  const cities = people.map(({ city }) => city.trim());
  for (const person of people) {
    const [first, ...family] = person.name.trim().split(/\s+/);
    if (!first) continue;
    const city = person.city.trim();
    if (city) {
      const options = choices(city, cities);
      pools.city.push({ kind: 'city', person, answer: city, options: options.length > 1 ? options : [] });
    }
    if (!portraitIds.has(person.id)) continue;
    if (family.length) pools.surname.push({ kind: 'surname', person, answer: family.join(' '), options: [] });
    const name = person.name.trim();
    const nameOptions = choices(name, names);
    if (nameOptions.length > 1) pools.name.push({ kind: 'name', person, answer: name, options: nameOptions });
    const otherFaces = shuffle(portraits.filter(({ id }) => id !== person.id)).slice(0, 3);
    if (otherFaces.length) {
      const options = shuffle([person, ...otherFaces]).map((photo) => ({ value: photo.id, photo }));
      pools.face.push({ kind: 'face', person, answer: person.id, options });
    }
  }

  const groups = Object.values(pools).map(shuffle);
  const round: QuizQuestion[] = [];
  while (groups.some((group) => group.length)) {
    for (const group of shuffle(groups)) {
      const question = group.pop();
      if (question) round.push(question);
    }
  }
  return round;
}
