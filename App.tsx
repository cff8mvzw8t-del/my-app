import React, { useMemo, useState } from 'react';
import {
  Animated,
  Alert,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { DavidLibre_400Regular, DavidLibre_500Medium, DavidLibre_700Bold } from '@expo-google-fonts/david-libre';
import * as ImagePicker from 'expo-image-picker';
import { colors as C, radius, spacing } from './theme';
import { createBackup, loadDeviceData, parseBackup, saveDeviceData, type SavedAppData } from './deviceStorage';
import { personGroups, normalizedPersonName, getReadinessCandidates, assignReadinessPerson, reconcileReadinessPeople } from './peopleAndReadiness';

type DomainTab = 'medical' | 'welfare' | 'fitness' | 'education' | 'readiness';
type Tab = 'home' | 'people' | 'guards' | 'roster' | 'tasks' | DomainTab;
export type Person = {
  id: string;
  name: string;
  city: string;
  role: string;
  status: string;
  statusTags: string[];
  photoUri?: string;
  color: string;
  statusDetails?: Partial<Record<PersonStatusField, string>>;
  group?: 'lone' | 'married' | 'other';
  isCommander?: boolean;
};
export type ReadinessShift = { id: string; time: string; fighterIds: string[]; commanderId: string };
const personStatusFields = [
  { key: 'medical', label: 'רפואי' },
  { key: 'welfare', label: 'ת״ש' },
  { key: 'fitness', label: 'כושר' },
  { key: 'discipline', label: 'משמעתי' },
  { key: 'values', label: 'ערכי' },
] as const;
type PersonStatusField = typeof personStatusFields[number]['key'];
export type GuardPost = {
  id: string;
  place: string;
  details: string;
};
export type GuardTimeSlot = {
  id: string;
  time: string;
};
export type GuardAssignment = {
  postId: string;
  slotId: string;
  personId: string;
};
export type TaskItem = {
  id: string;
  title: string;
  urgency: 'דחופה' | 'רגילה';
  importance: 'חשובה' | 'רגילה';
  due: string;
  done: boolean;
};
type Attendance = 'נוכח' | 'לא נוכח';
export type RosterEntry = {
  personId: string;
  attendance: Attendance;
  reason: string;
  base: string;
};
type RosterChoice = { personId: string; field: 'attendance' | 'reason' | 'base' };
type RosterBulkField = 'attendance' | 'base';

const DavidFontLoadedContext = React.createContext(false);

const peopleSeed: Person[] = [
  { id: 'p1', name: 'נועם לוי', city: 'חיפה', role: 'קשר', status: 'במסגרת', statusTags: ['הכשרה לדוגמה'], color: '#34213E' },
  { id: 'p2', name: 'איתי כהן', city: 'ראשון לציון', role: 'נהג', status: 'במסגרת', statusTags: ['תורנות לדוגמה'], color: '#25243A' },
  { id: 'p3', name: 'מיה ישראלי', city: 'באר שבע', role: 'חובשת', status: 'בחופשה', statusTags: ['תחרות לדוגמה'], color: '#38262D' },
  { id: 'p4', name: 'עומר פרץ', city: 'נתניה', role: 'לוגיסטיקה', status: 'במסגרת', statusTags: ['בסיס לדוגמה'], color: '#3A3325' },
  { id: 'p5', name: 'שירה אדרי', city: 'ירושלים', role: 'תצפית', status: 'במסגרת', statusTags: ['קורס לדוגמה'], color: '#263039' },
];

const guardPostsSeed: GuardPost[] = [
  { id: 'post-1', place: 'עמדה א׳', details: '' },
  { id: 'post-2', place: 'עמדה ב׳', details: '' },
  { id: 'post-3', place: 'עמדה ג׳', details: '' },
];

const guardTimeSlotsSeed: GuardTimeSlot[] = [
  { id: 'slot-1', time: '08:00 – 10:00' },
  { id: 'slot-2', time: '10:00 – 12:00' },
  { id: 'slot-3', time: '12:00 – 14:00' },
];
const readinessSeed: ReadinessShift[] = guardTimeSlotsSeed.map((slot) => ({ id: `ready-${slot.id}`, time: slot.time, fighterIds: ['', '', '', ''], commanderId: '' }));
const readinessFighterLabelSeed = ['לוחם 1', 'לוחם 2', 'לוחם 3', 'לוחם 4'];

const guardAssignmentsSeed: GuardAssignment[] = [
  { postId: 'post-1', slotId: 'slot-1', personId: 'p1' },
  { postId: 'post-2', slotId: 'slot-2', personId: 'p2' },
  { postId: 'post-3', slotId: 'slot-3', personId: 'p4' },
];

const taskSeed: TaskItem[] = [
  { id: 't1', title: 'לעבור על התכנון השבועי', urgency: 'דחופה', importance: 'חשובה', due: 'היום', done: false },
  { id: 't2', title: 'לעדכן את רשימת הציוד', urgency: 'רגילה', importance: 'חשובה', due: 'מחר', done: false },
  { id: 't3', title: 'לתאם שיחה עם הצוות', urgency: 'דחופה', importance: 'רגילה', due: 'יום ה׳', done: true },
];

const absenceReasonSeed = ['ר״ם 2', 'מיוחדת', 'חופשה שנתית', 'כלא', 'נפקד', 'יום סידורים', 'גימלים', 'בקורס'];
const baseSeed = ['בסיס 1', 'בסיס 2', 'בסיס 3'];
const rosterSeed: RosterEntry[] = peopleSeed.map((person, index) => {
  const attendance: Attendance = person.status === 'במסגרת' ? 'נוכח' : 'לא נוכח';
  return {
    personId: person.id,
    attendance,
    reason: attendance === 'לא נוכח' ? 'חופשה שנתית' : '',
    base: attendance === 'נוכח' ? baseSeed[index % baseSeed.length] : '',
  };
});

function createRosterEntry(person: Person, defaultBase: string): RosterEntry {
  const attendance: Attendance = person.status === 'במסגרת' ? 'נוכח' : 'לא נוכח';
  return { personId: person.id, attendance, reason: '', base: attendance === 'נוכח' ? defaultBase : '' };
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('');
}

function mixHex(start: string, end: string, amount: number) {
  const from = start.replace('#', '');
  const to = end.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const a = Number.parseInt(from.slice(offset, offset + 2), 16);
    const b = Number.parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function formatToday() {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function formatGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'בוקר טוב אייל';
  if (hour >= 12 && hour < 17) return 'צהריים טובים אייל';
  return 'ערב טוב אייל';
}

function getPerson(personId: string, people: Person[]) {
  return people.find((person) => person.id === personId) ?? {
    id: '', name: 'לא שובץ', city: '', role: 'אפשר לבחור שם מהרשימה', status: '', statusTags: [], color: '#1D1923',
  };
}

function getShiftTimes(time: string) {
  const [start = '08:00', end = '10:00'] = time.split(' – ');
  return { start, end };
}

function getPinchDistance(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches ?? [];
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function minutesOfDay(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function getCurrentAndNextGuardSlots(slots: GuardTimeSlot[], now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const current = slots.find((slot) => {
    const { start, end } = getShiftTimes(slot.time);
    const startMinutes = minutesOfDay(start);
    const endMinutes = minutesOfDay(end);
    return startMinutes <= endMinutes
      ? currentMinutes >= startMinutes && currentMinutes < endMinutes
      : currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }) ?? null;
  const next = slots
    .filter((slot) => slot.id !== current?.id)
    .sort((a, b) => {
      const aStart = minutesOfDay(getShiftTimes(a.time).start);
      const bStart = minutesOfDay(getShiftTimes(b.time).start);
      const aDistance = (aStart - currentMinutes + 1440) % 1440;
      const bDistance = (bStart - currentMinutes + 1440) % 1440;
      return aDistance - bDistance;
    })[0] ?? null;
  const nextIsTomorrow = !!next && minutesOfDay(getShiftTimes(next.time).start) <= currentMinutes;
  return { current, next, nextIsTomorrow };
}

function getSlotAssignments(posts: GuardPost[], assignments: GuardAssignment[], slotId?: string) {
  if (!slotId) return [];
  return posts.flatMap((post) => {
    const assignment = assignments.find((item) => item.postId === post.id && item.slotId === slotId);
    return assignment ? [{ place: post.place, personId: assignment.personId }] : [];
  });
}

function makeGuardRosterMessage(posts: GuardPost[], slots: GuardTimeSlot[], assignments: GuardAssignment[], people: Person[]) {
  const date = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const lines = [`שבצ״ק — ${date}`, ''];
  slots.forEach((slot) => {
    lines.push(`*${slot.time}*`);
    posts.forEach((post) => {
      const assignment = assignments.find((item) => item.postId === post.id && item.slotId === slot.id);
      const person = people.find((item) => item.id === assignment?.personId);
      lines.push(`${post.place}: ${person?.name ?? 'לא שובץ'}`);
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

function PageTitle({ eyebrow, title, caption }: { eyebrow?: string; title: string; caption?: string }) {
  return (
    <View style={styles.pageTitle}>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.pageHeading}>{title}</Text>
      {!!caption && <Text style={styles.pageCaption}>{caption}</Text>}
    </View>
  );
}

function Avatar({ person, size = 48 }: { person: Person; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: person.color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.31 }]}>{initials(person.name)}</Text>
    </View>
  );
}

function PersonPhoto({ person, size = 82 }: { person: Person; size?: number }) {
  if (person.photoUri) {
    return <Image source={{ uri: person.photoUri }} style={{ width: size, height: size, borderRadius: 18 }} />;
  }
  return (
    <View style={[styles.photoPlaceholder, { width: size, height: size, borderRadius: 18, backgroundColor: person.color }]}>
      <Text style={[styles.photoInitials, { fontSize: size * 0.28 }]}>{person.name ? initials(person.name) : '＋'}</Text>
      {!person.name && <Text style={styles.photoAddHint}>תמונה</Text>}
    </View>
  );
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && <Pressable onPress={onAction} hitSlop={10}><Text style={styles.linkText}>{action}</Text></Pressable>}
    </View>
  );
}

type IconName = 'home' | 'people' | 'clock' | 'roster' | 'tasks' | 'search' | 'plus' | 'chevron' | 'chevronDown' | 'settings' | 'share' | 'check' | 'sparkle' | 'close' | 'profile' | 'calendar' | 'taskCircle' | 'fox' | 'medical' | 'welfare' | 'fitness' | 'education' | 'readiness' | 'shield';
const plannedDomains: { key: DomainTab; title: string; icon: IconName; description: string }[] = [
  { key: 'medical', title: 'רפואה', icon: 'medical', description: 'מעקב אחר מצב רפואי, טיפולים, תורים והמשך טיפול.' },
  { key: 'welfare', title: 'ת״ש', icon: 'welfare', description: 'תמונת מצב של האנשים שיש להם פירוט ת״ש בתיק האישי.' },
  { key: 'fitness', title: 'כושר', icon: 'fitness', description: 'אימוני כוח וקארדיו, יעדים וההתקדמות של המחלקה.' },
  { key: 'education', title: 'חינוך', icon: 'education', description: 'תכנים שעברנו, תכנים מתוכננים ורעיונות להמשך.' },
  { key: 'readiness', title: 'כשירות', icon: 'readiness', description: 'מעקב אחר מטווחים, סימולטור ותרגילים יבשים ורטובים.' },
];

function getDavidFontFamily(style: React.ComponentProps<typeof NativeText>['style']) {
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  const numericWeight = Number(fontWeight);
  if (fontWeight === 'bold' || numericWeight >= 700) return 'DavidLibre_700Bold';
  if (numericWeight >= 500) return 'DavidLibre_500Medium';
  return 'DavidLibre_400Regular';
}

function Text({ style, ...props }: React.ComponentProps<typeof NativeText>) {
  const fontsLoaded = React.useContext(DavidFontLoadedContext);
  return <NativeText {...props} style={[style, { fontFamily: fontsLoaded ? getDavidFontFamily(style) : 'David' }]} />;
}

function TextInput({ style, ...props }: React.ComponentProps<typeof NativeTextInput>) {
  const fontsLoaded = React.useContext(DavidFontLoadedContext);
  return <NativeTextInput {...props} style={[style, { fontFamily: fontsLoaded ? getDavidFontFamily(style) : 'David' }]} />;
}

function AppIcon({ name, size = 20, color = C.ink, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const stroke = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  let shape: React.ReactNode;
  switch (name) {
    case 'fox': shape = <><Path d="M3 3 8.5 6.5 12 5.5 15.5 6.5 21 3 20 13.5 12 21 4 13.5 3 3Z" {...stroke} /><Path d="m3 3 3.5 8L12 16l5.5-5L21 3M7.5 12h1M15.5 12h1" {...stroke} /><Path d="M10.5 16.3h3L12 18Z" fill={color} /></>; break;
    case 'medical': shape = <><Rect x="3.5" y="3.5" width="17" height="17" rx="4" {...stroke} /><Path d="M12 7.5v9M7.5 12h9" {...stroke} /></>; break;
    case 'welfare': shape = <><Path d="M12 12.5 7.8 8.6a2.8 2.8 0 0 1 4.2-3.7 2.8 2.8 0 0 1 4.2 3.7L12 12.5ZM3 15h3l3 2h5a1.5 1.5 0 0 1 0 3H9l-3-1H3M15.5 17l3.5-3a1.6 1.6 0 0 1 2 2.5L16 21H9" {...stroke} /></>; break;
    case 'fitness': shape = <><Path d="M8 12h8M3 9v6M6 6v12M8 8v8M16 8v8M18 6v12M21 9v6M3 10h3M3 14h3M18 10h3M18 14h3" {...stroke} /></>; break;
    case 'education': shape = <><Path d="M12 6C9 3.7 6 3.5 3 4v15c3-.5 6-.3 9 2 3-2.3 6-2.5 9-2V4c-3-.5-6-.3-9 2Zm0 0v15" {...stroke} /></>; break;
    case 'readiness': shape = <><Circle cx="12" cy="12" r="9" {...stroke} /><Circle cx="12" cy="12" r="4.5" {...stroke} /><Path d="M12 10v4M10 12h4M18.5 5.5 22 2" {...stroke} /></>; break;
    case 'shield': shape = <><Path d="m12 3 8 3v6c0 4-4.5 7.2-8 9-3.5-1.8-8-5-8-9V6l8-3Z" {...stroke} /><Path d="m8.5 12 2.5 2.5 4.5-5" {...stroke} /></>; break;
    case 'search': shape = <><Circle cx="10.5" cy="10.5" r="6.5" {...stroke} /><Path d="m15.5 15.5 5 5" {...stroke} /></>; break;
    case 'home': shape = <Path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" {...stroke} fill={filled ? color : 'none'} />; break;
    case 'profile': shape = <><Circle cx="12" cy="7" r="3.5" {...stroke} /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" {...stroke} /></>; break;
    case 'calendar': shape = <><Rect x="3.5" y="5" width="17" height="16" rx="2" {...stroke} /><Path d="M7.5 2.5v5M16.5 2.5v5M4 11h16" {...stroke} /></>; break;
    case 'taskCircle': shape = <><Circle cx="12" cy="12" r="9" {...stroke} /><Path d="m7.5 12 3 3 6-6" {...stroke} /></>; break;
    case 'people': shape = <><Circle cx="9" cy="8" r="3.2" {...stroke} /><Path d="M3 20c.4-3.4 2.4-5.2 6-5.2s5.6 1.8 6 5.2M16 5.4a3 3 0 0 1 0 5.8M17.5 15c2 .7 3.1 2.2 3.5 4.5" {...stroke} /></>; break;
    case 'clock': shape = <><Circle cx="12" cy="12" r="9" {...stroke} /><Path d="M12 7v5l4 2.5" {...stroke} /></>; break;
    case 'roster': shape = <><Path d="M8 5h12M8 12h12M8 19h12" {...stroke} /><Circle cx="4" cy="5" r=".7" {...stroke} /><Circle cx="4" cy="12" r=".7" {...stroke} /><Circle cx="4" cy="19" r=".7" {...stroke} /></>; break;
    case 'tasks': shape = <><Rect x="4" y="3" width="16" height="18" rx="2.5" {...stroke} /><Path d="m7.5 12 2.5 2.5 6-6M8 6.8h8" {...stroke} /></>; break;
    case 'plus': shape = <Path d="M12 5v14M5 12h14" {...stroke} />; break;
    case 'chevron': shape = <Path d="m9 5 7 7-7 7" {...stroke} />; break;
    case 'chevronDown': shape = <Path d="m5 9 7 7 7-7" {...stroke} />; break;
    case 'close': shape = <Path d="m6 6 12 12M18 6 6 18" {...stroke} />; break;
    case 'settings': shape = <><Path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42" {...stroke} /><Circle cx="12" cy="12" r="4" {...stroke} /></>; break;
    case 'share': shape = <><Path d="m7 12 10-5M7 12l10 5" {...stroke} /><Circle cx="5" cy="12" r="2" {...stroke} /><Circle cx="19" cy="5.5" r="2" {...stroke} /><Circle cx="19" cy="18.5" r="2" {...stroke} /></>; break;
    case 'check': shape = <Path d="m5 12.5 4.2 4.2L19 7" {...stroke} />; break;
    case 'sparkle': shape = <><Path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" {...stroke} /><Path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2Z" {...stroke} /></>; break;
    default: shape = null;
  }
  const accessibilityProps = Platform.OS === 'web'
    ? { 'aria-hidden': true as const }
    : { accessible: false };
  return <Svg width={size} height={size} viewBox="0 0 24 24" {...accessibilityProps}>{shape}</Svg>;
}

function GradientProgressBar({ progress, label }: { progress: number; label: string }) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const percent = Math.round(boundedProgress * 100);
  const stops = Array.from({ length: 40 }, (_, index) => mixHex(C.purpleDeep, C.violet, index / 39));
  return (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[styles.progressFill, { width: `${percent}%` }]}>
        <View style={styles.progressSegments}>
          {stops.map((color, index) => <View key={index} style={[styles.progressSegment, { backgroundColor: color }]} />)}
        </View>
      </View>
    </View>
  );
}

function Pill({ label, tone = 'green' }: { label: string; tone?: 'green' | 'orange' | 'red' | 'blue' | 'neutral' }) {
  const toneStyle = {
    green: styles.pillGreen,
    orange: styles.pillOrange,
    red: styles.pillRed,
    blue: styles.pillBlue,
    neutral: styles.pillNeutral,
  }[tone];
  const textStyle = {
    green: styles.pillTextGreen,
    orange: styles.pillTextOrange,
    red: styles.pillTextRed,
    blue: styles.pillTextBlue,
    neutral: styles.pillTextNeutral,
  }[tone];
  return <View style={[styles.pill, toneStyle]}><Text style={[styles.pillText, textStyle]}>{label}</Text></View>;
}

export default function App() {
  const [stored] = useState(() => loadDeviceData());
  const initialData = stored.kind === 'ready' ? stored.data : undefined;
  const [savingAllowed, setSavingAllowed] = useState(stored.kind === 'ready');
  const [saveState, setSaveState] = useState<'saved' | 'error' | 'blocked' | 'unavailable'>(stored.kind === 'ready' ? 'saved' : stored.kind === 'error' ? 'blocked' : 'unavailable');
  const [backupOpen, setBackupOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [pendingRestore, setPendingRestore] = useState<SavedAppData | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    DavidLibre_400Regular,
    DavidLibre_500Medium,
    DavidLibre_700Bold,
  });
  const [tab, setTab] = useState<Tab>('home');
  const activeDomain = plannedDomains.find((domain) => domain.key === tab);
  const screenProgress = React.useRef(new Animated.Value(1)).current;
  const [people, setPeople] = useState<Person[]>(initialData?.people ?? peopleSeed);
  const [peopleSelecting, setPeopleSelecting] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [deletePeopleOpen, setDeletePeopleOpen] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'commanders'>('all');
  const [peopleZoom, setPeopleZoom] = useState(1);
  const peopleZoomRef = React.useRef(1);
  const pinchStart = React.useRef({ distance: 0, zoom: 1 });
  const [guardPosts, setGuardPosts] = useState<GuardPost[]>(initialData?.guardPosts ?? guardPostsSeed);
  const [guardTimeSlots, setGuardTimeSlots] = useState<GuardTimeSlot[]>(initialData?.guardTimeSlots ?? guardTimeSlotsSeed);
  const [guardAssignments, setGuardAssignments] = useState<GuardAssignment[]>(initialData?.guardAssignments ?? guardAssignmentsSeed);
  const [readinessShifts, setReadinessShifts] = useState<ReadinessShift[]>(initialData?.readinessShifts ?? readinessSeed);
  const [readinessFighterLabels, setReadinessFighterLabels] = useState<string[]>(initialData?.readinessFighterLabels ?? readinessFighterLabelSeed);
  const [editingReadinessLabel, setEditingReadinessLabel] = useState<{ index: number; value: string } | null>(null);
  const [readinessPicker, setReadinessPicker] = useState<{ shiftId: string; role: 'fighter' | 'commander'; fighterIndex?: number } | null>(null);
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>(initialData?.rosterEntries ?? rosterSeed);
  const [absenceReasons, setAbsenceReasons] = useState<string[]>(initialData?.absenceReasons ?? absenceReasonSeed);
  const [baseOptions, setBaseOptions] = useState<string[]>(initialData?.baseOptions ?? baseSeed);
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [rosterChoice, setRosterChoice] = useState<RosterChoice | null>(null);
  const [rosterSettingsOpen, setRosterSettingsOpen] = useState(false);
  const [bulkRosterOpen, setBulkRosterOpen] = useState(false);
  const [bulkField, setBulkField] = useState<RosterBulkField>('attendance');
  const [bulkAttendance, setBulkAttendance] = useState<Attendance>('נוכח');
  const [bulkReason, setBulkReason] = useState((initialData?.absenceReasons ?? absenceReasonSeed)[0] ?? '');
  const [bulkBase, setBulkBase] = useState((initialData?.baseOptions ?? baseSeed)[0] ?? '');
  const [tasks, setTasks] = useState<TaskItem[]>(initialData?.tasks ?? taskSeed);
  const [search, setSearch] = useState('');
  const [activePerson, setActivePerson] = useState<{ person: Person; editing: boolean } | null>(null);
  const [editingGuard, setEditingGuard] = useState<GuardPost | null>(null);
  const [peoplePickerCell, setPeoplePickerCell] = useState<{ postId: string; slotId: string } | null>(null);
  const [timePicker, setTimePicker] = useState<{ slotId: string; part: 'start' | 'end'; value: string; target?: 'readiness' } | null>(null);
  const [rosterCopied, setRosterCopied] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [assistantInfoOpen, setAssistantInfoOpen] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('היום');
  const [taskUrgency, setTaskUrgency] = useState<'דחופה' | 'רגילה'>('רגילה');
  const [taskImportance, setTaskImportance] = useState<'חשובה' | 'רגילה'>('רגילה');

  const savedData = useMemo<SavedAppData>(() => ({ people, guardPosts, guardTimeSlots, guardAssignments, readinessShifts, readinessFighterLabels, rosterEntries, absenceReasons, baseOptions, tasks }), [people, guardPosts, guardTimeSlots, guardAssignments, readinessShifts, readinessFighterLabels, rosterEntries, absenceReasons, baseOptions, tasks]);
  React.useEffect(() => {
    if (!savingAllowed) return;
    try {
      saveDeviceData(savedData);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [savedData, savingAllowed]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const original = viewport?.content;
    if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ', viewport-fit=cover';
    const safeAreaStyle = document.createElement('style');
    // Rows already use row-reverse for Hebrew. Inheriting RTL from the HTML
    // element would reverse them a second time and move flex-end text left.
    safeAreaStyle.textContent = `
      html, body { background: #000; margin: 0; overflow: hidden; overscroll-behavior: none; -webkit-text-size-adjust: 100%; }
      #root { position: fixed; inset: 0; width: 100%; height: 100%; min-height: 0; overflow: hidden; direction: ltr; background: #000; }
      @supports (height: 100dvh) { #root { height: 100dvh; } }
      #app-safe-area { min-height: 0; padding-bottom: 0 !important; }
      #app-bottom-navigation { direction: ltr; padding-bottom: max(18px, env(safe-area-inset-bottom, 0px)); }
    `;
    document.head.appendChild(safeAreaStyle);
    return () => {
      safeAreaStyle.remove();
      if (viewport && original !== undefined) viewport.content = original;
    };
  }, []);

  function downloadBackup(raw = createBackup(savedData), prefix = 'my-roster-backup') {
    if (Platform.OS !== 'web') return;
    try {
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setBackupMessage('הגיבוי הוכן. באייפון שמור אותו בקבצים כדי שתוכל לשחזר ממנו.');
    } catch {
      setBackupMessage('לא הצלחתי להכין את קובץ הגיבוי. נסה שוב.');
    }
  }

  function chooseBackup() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Backup too large');
        const data = parseBackup(await file.text());
        setPendingRestore(data);
        setBackupMessage('');
      } catch {
        setBackupMessage('הקובץ אינו גיבוי תקין של האפליקציה. המידע הקיים לא השתנה.');
      }
    };
    input.addEventListener('cancel', () => input.remove(), { once: true });
    document.body.appendChild(input);
    input.click();
  }

  function restoreBackup() {
    if (!pendingRestore) return;
    try {
      // Write first: a full device or blocked storage must not discard the current screen's data.
      saveDeviceData(pendingRestore);
    } catch {
      setBackupMessage('אין אפשרות לשמור במכשיר כרגע. השחזור לא בוצע והמידע הקיים לא השתנה.');
      return;
    }
    setPeople(pendingRestore.people);
    setGuardPosts(pendingRestore.guardPosts);
    setGuardTimeSlots(pendingRestore.guardTimeSlots);
    setGuardAssignments(pendingRestore.guardAssignments);
    setReadinessShifts(pendingRestore.readinessShifts ?? readinessSeed);
    setReadinessFighterLabels(pendingRestore.readinessFighterLabels ?? readinessFighterLabelSeed);
    setEditingReadinessLabel(null);
    setRosterEntries(pendingRestore.rosterEntries);
    setAbsenceReasons(pendingRestore.absenceReasons);
    setBaseOptions(pendingRestore.baseOptions);
    setTasks(pendingRestore.tasks);
    setBulkReason(pendingRestore.absenceReasons[0] ?? '');
    setBulkBase(pendingRestore.baseOptions[0] ?? '');
    setSelectedPeopleIds([]);
    setSelectedRosterIds([]);
    setPeopleSelecting(false);
    setActivePerson(null);
    setEditingGuard(null);
    setPeoplePickerCell(null);
    setReadinessPicker(null);
    setTimePicker(null);
    setRosterChoice(null);
    setBulkRosterOpen(false);
    setRosterSettingsOpen(false);
    setSearch('');
    setPendingRestore(null);
    setSavingAllowed(true);
    setSaveState('saved');
    setBackupMessage('הגיבוי שוחזר ונשמר במכשיר.');
  }

  React.useEffect(() => {
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    screenProgress.setValue(0.94);
    Animated.timing(screenProgress, {
      toValue: 1,
      duration: 190,
      useNativeDriver: false,
    }).start();
  }, [tab, screenProgress]);

  const activeCount = people.filter((person) => person.status === 'במסגרת').length;
  const openTaskCount = tasks.filter((task) => !task.done).length;
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const score = (task: TaskItem) => (task.urgency === 'דחופה' ? 4 : 0) + (task.importance === 'חשובה' ? 2 : 0) + (task.due === 'היום' ? 1 : 0);
    return score(b) - score(a);
  }), [tasks]);
  const { current: currentGuardSlot, next: nextGuardSlot, nextIsTomorrow } = useMemo(
    () => getCurrentAndNextGuardSlots(guardTimeSlots),
    [guardTimeSlots, clockTick],
  );
  const currentGuardPeople = getSlotAssignments(guardPosts, guardAssignments, currentGuardSlot?.id);
  const nextGuardPeople = getSlotAssignments(guardPosts, guardAssignments, nextGuardSlot?.id);
  const rosterById = useMemo(() => new Map(rosterEntries.map((entry) => [entry.personId, entry])), [rosterEntries]);
  const rosterRows = people.map((person) => ({
    person,
    entry: rosterById.get(person.id) ?? createRosterEntry(person, baseOptions[0] ?? ''),
  }));
  const presentRosterCount = rosterRows.filter(({ entry }) => entry.attendance === 'נוכח').length;
  const absentRosterCount = rosterRows.length - presentRosterCount;
  const activeRosterChoice = rosterChoice ? rosterRows.find(({ person }) => person.id === rosterChoice.personId)?.entry : undefined;
  const rosterChoiceOptions = rosterChoice?.field === 'attendance'
    ? ['נוכח', 'לא נוכח']
    : rosterChoice?.field === 'reason' ? absenceReasons : baseOptions;
  const rosterChoiceValue = rosterChoice?.field === 'attendance'
    ? activeRosterChoice?.attendance ?? ''
    : rosterChoice?.field === 'reason' ? activeRosterChoice?.reason ?? '' : activeRosterChoice?.base ?? '';
  const filteredPeople = people.filter((person) => (peopleFilter !== 'commanders' || person.isCommander) && (person.name.includes(search.trim()) || person.role.includes(search.trim())));
  const activeReadinessShift = readinessShifts.find((shift) => shift.id === readinessPicker?.shiftId);
  const readinessCandidates = activeReadinessShift && readinessPicker ? getReadinessCandidates(people, activeReadinessShift, readinessPicker.role, readinessPicker.fighterIndex) : [];
  const compactPeopleView = peopleZoom < 0.9;
  const compactColumns = peopleZoom <= 0.72 ? 4 : 3;
  const largePeopleView = peopleZoom > 1.18;
  const peoplePinchResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => (event.nativeEvent.touches?.length ?? 0) >= 2,
    onMoveShouldSetPanResponder: (event) => (event.nativeEvent.touches?.length ?? 0) >= 2,
    onStartShouldSetPanResponderCapture: (event) => (event.nativeEvent.touches?.length ?? 0) >= 2,
    onMoveShouldSetPanResponderCapture: (event) => (event.nativeEvent.touches?.length ?? 0) >= 2,
    onPanResponderGrant: (event) => {
      pinchStart.current = { distance: getPinchDistance(event), zoom: peopleZoomRef.current };
    },
    onPanResponderMove: (event) => {
      const distance = getPinchDistance(event);
      if (!pinchStart.current.distance || !distance) return;
      const nextZoom = Math.max(0.62, Math.min(1.45, pinchStart.current.zoom * distance / pinchStart.current.distance));
      if (Math.abs(nextZoom - peopleZoomRef.current) < 0.025) return;
      peopleZoomRef.current = nextZoom;
      setPeopleZoom(nextZoom);
    },
  }), []);

  const openGuards = () => setTab('guards');

  function updateRosterEntry(personId: string, patch: Partial<RosterEntry>) {
    const person = people.find((item) => item.id === personId);
    if (!person) return;
    setRosterEntries((current) => {
      const existing = current.find((item) => item.personId === personId);
      const nextEntry = { ...(existing ?? createRosterEntry(person, baseOptions[0] ?? '')), ...patch };
      return existing
        ? current.map((item) => item.personId === personId ? nextEntry : item)
        : [...current, nextEntry];
    });
  }

  function toggleRosterSelection(personId: string) {
    setSelectedRosterIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId]);
  }

  function saveRosterChoice(value: string) {
    if (!rosterChoice) return;
    if (rosterChoice.field === 'attendance') {
      const attendance = value as Attendance;
      const person = people.find((item) => item.id === rosterChoice.personId);
      const current = rosterEntries.find((item) => item.personId === rosterChoice.personId)
        ?? (person ? createRosterEntry(person, baseOptions[0] ?? '') : null);
      updateRosterEntry(rosterChoice.personId, {
        attendance,
        reason: attendance === 'לא נוכח' ? current?.reason ?? '' : '',
        base: attendance === 'נוכח' ? current?.base || baseOptions[0] || '' : current?.base ?? '',
      });
    } else {
      updateRosterEntry(rosterChoice.personId, { [rosterChoice.field]: value });
    }
    setRosterChoice(null);
  }

  function applyRosterBulkUpdate() {
    if (selectedRosterIds.length === 0) return;
    const selected = new Set(selectedRosterIds);
    setRosterEntries((current) => {
      const entries = new Map(current.map((entry) => [entry.personId, entry]));
      people.forEach((person) => {
        if (!selected.has(person.id)) return;
        const entry = entries.get(person.id) ?? createRosterEntry(person, baseOptions[0] ?? '');
        entries.set(person.id, bulkField === 'base'
          ? { ...entry, base: bulkBase }
          : {
              ...entry,
              attendance: bulkAttendance,
              reason: bulkAttendance === 'לא נוכח' ? bulkReason : '',
              base: bulkAttendance === 'נוכח' ? entry.base || baseOptions[0] || '' : entry.base,
            });
      });
      return Array.from(entries.values());
    });
    setBulkRosterOpen(false);
    setSelectedRosterIds([]);
  }

  function saveRosterSettings(nextReasons: string[], nextBases: string[]) {
    setAbsenceReasons(nextReasons);
    setBaseOptions(nextBases);
    setRosterEntries((current) => current.map((entry) => ({
      ...entry,
      reason: entry.reason && !nextReasons.includes(entry.reason) ? '' : entry.reason,
      base: entry.base && !nextBases.includes(entry.base) ? '' : entry.base,
    })));
    if (!nextReasons.includes(bulkReason)) setBulkReason(nextReasons[0] ?? '');
    if (!nextBases.includes(bulkBase)) setBulkBase(nextBases[0] ?? '');
    setRosterSettingsOpen(false);
  }

  function changePeopleZoom(amount: number) {
    const nextZoom = Math.max(0.62, Math.min(1.45, peopleZoomRef.current + amount));
    peopleZoomRef.current = nextZoom;
    setPeopleZoom(nextZoom);
  }

  async function shareGuardRoster() {
    const message = makeGuardRosterMessage(guardPosts, guardTimeSlots, guardAssignments, people);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        setRosterCopied(true);
        setTimeout(() => setRosterCopied(false), 2500);
        return;
      }
      await Share.share({ title: 'שבצ״ק', message });
    } catch {
      Alert.alert('לא הצלחתי להעתיק', 'אפשר לנסות שוב או לשתף מתוך הטבלה.');
    }
  }

  function beginNewPerson() {
    setActivePerson({
      person: { id: '', name: '', city: '', role: '', status: 'במסגרת', statusTags: [], color: '#34213E', group: 'other', isCommander: false },
      editing: true,
    });
  }

  function togglePeopleSelection(personId: string) {
    setSelectedPeopleIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId) : [...current, personId]);
  }

  function deleteSelectedPeople() {
    const selected = new Set(selectedPeopleIds);
    setPeople((current) => current.filter((person) => !selected.has(person.id)));
    setRosterEntries((current) => current.filter((entry) => !selected.has(entry.personId)));
    setGuardAssignments((current) => current.filter((entry) => !selected.has(entry.personId)));
    setReadinessShifts((current) => reconcileReadinessPeople(current, people.filter((person) => !selected.has(person.id))));
    setSelectedRosterIds((current) => current.filter((id) => !selected.has(id)));
    setSelectedPeopleIds([]);
    setPeopleSelecting(false);
    setDeletePeopleOpen(false);
  }

  function savePerson(person: Person) {
    if (people.some((item) => item.id !== person.id && normalizedPersonName(item.name) === normalizedPersonName(person.name))) return;
    const savedPerson = { ...person, name: person.name.trim().replace(/\s+/g, ' '), id: person.id || `p${Date.now()}` };
    const nextPeople = people.some((item) => item.id === savedPerson.id) ? people.map((item) => item.id === savedPerson.id ? savedPerson : item) : [savedPerson, ...people];
    setReadinessShifts((current) => reconcileReadinessPeople(current, nextPeople));
    setPeople((current) => current.some((item) => item.id === savedPerson.id)
      ? current.map((item) => item.id === savedPerson.id ? savedPerson : item)
      : [savedPerson, ...current]);
    setActivePerson(null);
    if (!person.id) setSearch('');
    if (!person.id) setPeopleFilter('all');
  }

  function addReadinessShift() {
    const last = readinessShifts[readinessShifts.length - 1];
    const start = last ? getShiftTimes(last.time).end : '08:00';
    const [hour, minute] = start.split(':');
    const end = `${String((Number(hour) + 2) % 24).padStart(2, '0')}:${minute ?? '00'}`;
    setReadinessShifts((current) => [...current, { id: `ready-${Date.now()}`, time: `${start} – ${end}`, fighterIds: ['', '', '', ''], commanderId: '' }]);
  }

  function assignReadiness(personId: string) {
    if (!readinessPicker) return;
    setReadinessShifts((current) => current.map((shift) => shift.id === readinessPicker.shiftId ? assignReadinessPerson(shift, people, readinessPicker.role, readinessPicker.fighterIndex, personId) : shift));
    setReadinessPicker(null);
  }

  function addGuard() {
    const nextNumber = guardPosts.length + 1;
    setGuardPosts((current) => [...current, { id: `post-${Date.now()}`, place: `עמדה ${nextNumber}`, details: '' }]);
  }

  function addGuardTimeSlot() {
    const lastSlot = guardTimeSlots[guardTimeSlots.length - 1];
    const start = lastSlot ? getShiftTimes(lastSlot.time).end : '08:00';
    const [hour, minute] = start.split(':');
    const end = `${String((Number(hour) + 2) % 24).padStart(2, '0')}:${minute ?? '00'}`;
    setGuardTimeSlots((current) => [...current, { id: `slot-${Date.now()}`, time: `${start} – ${end}` }]);
  }

  function saveGuard(updated: GuardPost) {
    setGuardPosts((current) => current.map((item) => item.id === updated.id ? updated : item));
    setEditingGuard(null);
  }

  function assignPerson(cell: { postId: string; slotId: string }, personId: string) {
    setGuardAssignments((current) => {
      const exists = current.some((item) => item.postId === cell.postId && item.slotId === cell.slotId);
      if (!personId) return current.filter((item) => item.postId !== cell.postId || item.slotId !== cell.slotId);
      return exists
        ? current.map((item) => item.postId === cell.postId && item.slotId === cell.slotId ? { ...item, personId } : item)
        : [...current, { ...cell, personId }];
    });
    setPeoplePickerCell(null);
  }

  function saveGuardTime(value: string) {
    if (!timePicker) return;
    if (timePicker.target === 'readiness') {
      setReadinessShifts((current) => current.map((shift) => {
        if (shift.id !== timePicker.slotId) return shift;
        const times = getShiftTimes(shift.time);
        return { ...shift, time: `${timePicker.part === 'start' ? value : times.start} – ${timePicker.part === 'end' ? value : times.end}` };
      }));
      setTimePicker(null);
      return;
    }
    setGuardTimeSlots((current) => current.map((item) => {
      if (item.id !== timePicker.slotId) return item;
      const times = getShiftTimes(item.time);
      return { ...item, time: `${timePicker.part === 'start' ? value : times.start} – ${timePicker.part === 'end' ? value : times.end}` };
    }));
    setTimePicker(null);
  }

  function saveTask() {
    const title = taskTitle.trim();
    if (!title) return;
    setTasks((current) => [{ id: `t${Date.now()}`, title, urgency: taskUrgency, importance: taskImportance, due: taskDue.trim() || 'היום', done: false }, ...current]);
    setTaskTitle('');
    setTaskDue('היום');
    setTaskUrgency('רגילה');
    setTaskImportance('רגילה');
    setTaskModalOpen(false);
  }

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.background }} />;

  return (
    <DavidFontLoadedContext.Provider value={fontsLoaded}>
    <SafeAreaView nativeID="app-safe-area" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <View style={styles.appFrame}>
        <Animated.View style={[styles.screenTransition, {
          opacity: screenProgress,
          transform: [{ translateY: screenProgress.interpolate({ inputRange: [0.94, 1], outputRange: [6, 0] }) }],
        }]}>
        <ScrollView contentContainerStyle={[styles.scrollContent, tab === 'home' && styles.homeScrollContent]} showsVerticalScrollIndicator={false}>
          {tab === 'home' && (
            <>
              <ImageBackground source={require('./assets/home-mountains-v1.png')} resizeMode="stretch" imageStyle={styles.homeMountainImage} style={styles.homeHero}>
                <View pointerEvents="none" style={styles.homeMountainFade}>
                  {Array.from({ length: 24 }, (_, index) => {
                    const alpha = ((index + 1) / 24).toFixed(2);
                    return <View key={index} style={[styles.homeMountainFadeStep, { backgroundColor: `rgba(0,0,0,${alpha})` }]} />;
                  })}
                </View>
                <View style={styles.topBar}>
                  <View style={styles.brandMark}><Text style={styles.brandMarkText}>מ</Text></View>
                  <View style={styles.homeBrandCopy}>
                    <Text style={styles.brandName}>המסגרת שלי</Text>
                    <Text style={styles.homeMotto}>איתך לעד</Text>
                  </View>
                  <View style={styles.topBarSpacer} />
                  <Pressable style={({ pressed }) => [styles.topIconButton, pressed && styles.pressedControl]} onPress={() => setTab('people')} accessibilityRole="button" accessibilityLabel="פתיחת רשימת אנשים">
                    <AppIcon name="search" color={C.ink} />
                  </Pressable>
                </View>
                <View style={styles.greetingBlock}>
                  <Text style={styles.greetingSmall}>{formatToday()}</Text>
                  <Text style={styles.greetingTitle}>{formatGreeting()}</Text>
                  <Text style={styles.greetingSubtitle}>תמונת מצב יומית, במקום אחד</Text>
                </View>
              </ImageBackground>

              <View style={styles.homeFeatureRow}>
                <Pressable
                  style={({ pressed }) => [styles.homeFeatureCard, pressed && styles.pressedControl]}
                  onPress={() => setAssistantInfoOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="מידע על חיבור עתידי לאסיסטנט"
                >
                  <View style={styles.homeFeatureIcon}><AppIcon name="sparkle" size={22} color={C.violetLight} /></View>
                  <Text style={styles.homeFeatureTitle}>אסיסטנט</Text>
                  <Text style={styles.homeFeatureValue}>בתכנון</Text>
                  <Text style={styles.homeFeatureNote}>חיבור עתידי</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.homeFeatureCard, pressed && styles.pressedControl]}
                  onPress={() => setTab('roster')}
                  accessibilityRole="button"
                  accessibilityLabel="פתיחת מצב נוכחות"
                >
                  <View style={styles.homeFeatureIcon}><AppIcon name="people" size={22} color={C.violetLight} /></View>
                  <Text style={styles.homeFeatureTitle}>מצב נוכחות</Text>
                  <Text style={styles.homeFeatureValue}>{presentRosterCount}/{rosterRows.length} נוכחים</Text>
                  <Text style={styles.homeFeatureNote}>עדכון מהמצבה</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.homeFeatureCard, pressed && styles.pressedControl]}
                  onPress={openGuards}
                  accessibilityRole="button"
                  accessibilityLabel="פתיחת מצב השמירות והכוננויות"
                >
                  <View style={styles.homeFeatureIcon}><AppIcon name="clock" size={22} color={C.violetLight} /></View>
                  <Text style={styles.homeFeatureTitle}>שמירה הבאה</Text>
                  <Text style={styles.homeFeatureValue}>{nextGuardSlot ? getShiftTimes(nextGuardSlot.time).start : '—'}</Text>
                  <Text style={styles.homeFeatureNote}>{nextGuardSlot ? (nextIsTomorrow ? 'מחר' : 'היום') : 'לא הוגדרה'}</Text>
                </Pressable>
              </View>

              <SectionHeading title="מצב השמירות והכוננויות" action="פתיחת הלוח" onAction={openGuards} />
              <View style={[styles.card, styles.homeGuardCard]}>
                <View style={styles.guardStatusGroup}>
                  <View style={styles.guardStatusHeader}>
                    <Text style={styles.guardStatusTitle}>{currentGuardSlot ? 'בשמירה עכשיו' : 'אין שמירה פעילה כרגע'}</Text>
                    {currentGuardSlot && <Pill label={currentGuardSlot.time} tone="green" />}
                  </View>
                  {currentGuardSlot && currentGuardPeople.length > 0 ? currentGuardPeople.map((entry) => (
                    <View key={entry.place} style={styles.guardStatusRow}>
                      <Text style={styles.guardStatusPlace}>{entry.place}</Text>
                      <Text style={styles.guardStatusName}>{getPerson(entry.personId, people).name}</Text>
                    </View>
                  )) : <Text style={styles.guardStatusEmpty}>{currentGuardSlot ? 'אין אנשים משובצים בשעה הזאת.' : 'אין כרגע טווח שעות פעיל.'}</Text>}
                </View>
                <View style={styles.guardStatusDivider} />
                <View style={styles.guardStatusGroup}>
                  <View style={styles.guardStatusHeader}>
                    <Text style={styles.guardStatusTitle}>מי עולה בשמירה הבאה</Text>
                    {nextGuardSlot && (
                      <View style={[styles.pill, styles.pillOrange, styles.homeTimePill]}>
                        {nextIsTomorrow && <Text style={[styles.pillText, styles.pillTextOrange]}>מחר ·</Text>}
                        <Text style={[styles.pillText, styles.pillTextOrange, styles.homeLtrTime]}>{`${getShiftTimes(nextGuardSlot.time).start} – ${getShiftTimes(nextGuardSlot.time).end}`}</Text>
                      </View>
                    )}
                  </View>
                  {nextGuardSlot && nextGuardPeople.length > 0 ? nextGuardPeople.map((entry) => (
                    <View key={entry.place} style={styles.guardStatusRow}>
                      <Text style={styles.guardStatusPlace}>{entry.place}</Text>
                      <Text style={styles.guardStatusName}>{getPerson(entry.personId, people).name}</Text>
                    </View>
                  )) : <Text style={styles.guardStatusEmpty}>{nextGuardSlot ? 'אין עדיין שיבוצים לשעה הבאה.' : 'לא הוגדר טווח שעות נוסף.'}</Text>}
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.homeProgressCard, pressed && styles.pressedControl]}
                onPress={() => setTab('roster')}
                accessibilityRole="button"
                accessibilityLabel="פתיחת המצבה ועדכון תמונת הנוכחות"
              >
                <View style={styles.homeProgressHeader}>
                  <View style={styles.homeProgressCopy}>
                    <Text style={styles.homeProgressTitle}>תמונת מצב נוכחות</Text>
                    <Text style={styles.homeProgressCaption}>{presentRosterCount} נוכחים · {absentRosterCount} לא נוכחים</Text>
                  </View>
                  <Text style={styles.homeProgressPercent}>{rosterRows.length ? Math.round((presentRosterCount / rosterRows.length) * 100) : 0}%</Text>
                </View>
                <GradientProgressBar progress={rosterRows.length ? presentRosterCount / rosterRows.length : 0} label="אחוז נוכחות" />
              </Pressable>
            </>
          )}

          {tab === 'people' && (
            <>
              <PageTitle eyebrow="המרחב שלך" title="אנשים" caption={`${people.length} אנשים ברשימה`} />
              <View style={styles.searchBox}><AppIcon name="search" size={18} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="חיפוש לפי שם או תפקיד" placeholderTextColor={C.muted} style={styles.searchInput} textAlign="right" /></View>
              <View style={styles.peopleZoomRow}>
                <Text style={styles.peopleZoomHint}>צביטה בשתי אצבעות לשינוי גודל</Text>
                <View style={styles.peopleZoomControls}>
                  <Pressable style={styles.zoomButton} onPress={() => changePeopleZoom(-0.15)} accessibilityLabel="הקטנת התצוגה"><Text style={styles.zoomButtonText}>−</Text></Pressable>
                  <Text style={styles.zoomValue}>{Math.round(peopleZoom * 100)}%</Text>
                  <Pressable style={styles.zoomButton} onPress={() => changePeopleZoom(0.15)} accessibilityLabel="הגדלת התצוגה"><Text style={styles.zoomButtonText}>＋</Text></Pressable>
                </View>
              </View>
              <View style={styles.peopleControls}>
                <Pressable style={styles.addButton} onPress={beginNewPerson}><AppIcon name="plus" size={14} color={C.ink} /><Text style={styles.addButtonText}>הוספת אדם</Text></Pressable>
                <View style={styles.filterRow}><Pill label={`${activeCount} במסגרת`} tone="green" /><Pill label={`${people.length - activeCount} מחוץ למסגרת`} tone="neutral" /></View>
              </View>
              <View style={styles.peopleActionRow}>
                <Pressable style={styles.peopleActionButton} onPress={() => { setPeopleSelecting(!peopleSelecting); setSelectedPeopleIds([]); }} accessibilityRole="button">
                  <Text style={styles.peopleActionText}>{peopleSelecting ? 'סיום בחירה' : 'בחירת אנשים'}</Text>
                </Pressable>
                <Pressable style={[styles.peopleActionButton, peopleFilter === 'all' && styles.personSelected]} onPress={() => setPeopleFilter('all')} accessibilityRole="button" accessibilityState={{ selected: peopleFilter === 'all' }}><Text style={styles.peopleActionText}>כולם</Text></Pressable>
                <Pressable style={[styles.peopleActionButton, peopleFilter === 'commanders' && styles.personSelected]} onPress={() => setPeopleFilter('commanders')} accessibilityRole="button" accessibilityState={{ selected: peopleFilter === 'commanders' }}><Text style={styles.peopleActionText}>מפקדים</Text></Pressable>
              </View>
              {peopleSelecting && (
                <View style={styles.peopleSelectionToolbar}>
                  <Text style={styles.peopleActionText}>{selectedPeopleIds.length} נבחרו</Text>
                  <Pressable style={styles.peopleActionButton} onPress={() => setSelectedPeopleIds((current) => Array.from(new Set([...current, ...filteredPeople.map((person) => person.id)])))} accessibilityRole="button"><Text style={styles.peopleActionText}>בחר הכול בתצוגה</Text></Pressable>
                  <Pressable style={styles.peopleActionButton} onPress={() => setSelectedPeopleIds([])} accessibilityRole="button"><Text style={styles.peopleActionText}>נקה בחירה</Text></Pressable>
                  <Pressable disabled={!selectedPeopleIds.length} style={[styles.peopleDeleteButton, !selectedPeopleIds.length && styles.primaryButtonDisabled]} onPress={() => setDeletePeopleOpen(true)} accessibilityRole="button"><Text style={styles.peopleDeleteText}>מחיקת המסומנים</Text></Pressable>
                </View>
              )}
              <View {...peoplePinchResponder.panHandlers}>
                {personGroups.map((group) => {
                  const sectionPeople = filteredPeople.filter((person) => (person.group ?? 'other') === group.key);
                  return <View key={group.key} style={styles.peopleSection}>
                    <View style={styles.peopleSectionHeader}><Text style={styles.sectionTitle}>{group.label}</Text><Pill label={`${sectionPeople.length}`} tone="neutral" /></View>
                    {sectionPeople.length === 0 && <Text style={styles.peopleSectionEmpty}>אין אנשים בקבוצה הזו</Text>}
                {compactPeopleView ? (
                  <View style={styles.peopleCompactGrid}>
                    {sectionPeople.map((person) => (
                      <Pressable key={person.id} style={[styles.personCompactCard, { width: compactColumns === 4 ? '23.5%' : '31.7%' }, selectedPeopleIds.includes(person.id) && styles.personSelected]} onPress={() => peopleSelecting ? togglePeopleSelection(person.id) : setActivePerson({ person, editing: false })} accessibilityRole={peopleSelecting ? 'checkbox' : 'button'} accessibilityState={peopleSelecting ? { checked: selectedPeopleIds.includes(person.id) } : {}} accessibilityLabel={person.name}>
                        {peopleSelecting && <View style={[styles.checkBox, styles.peopleCardCheck, selectedPeopleIds.includes(person.id) && styles.checkBoxDone]}>{selectedPeopleIds.includes(person.id) && <AppIcon name="check" size={15} />}</View>}
                        <Text style={styles.personCompactName} numberOfLines={2}>{person.name}</Text>
                        <Text style={[styles.personCompactStatus, person.status === 'במסגרת' ? styles.personCompactStatusActive : styles.personCompactStatusAway]} numberOfLines={1}>{person.isCommander ? `מפקד · ${person.status}` : person.status}</Text>
                        <Text style={styles.personCompactLocation} numberOfLines={1}>{person.city || 'מיקום לא צוין'}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.peopleGrid}>
                    {sectionPeople.map((person) => (
                      <Pressable key={person.id} style={[styles.personCard, largePeopleView && styles.personCardLarge, selectedPeopleIds.includes(person.id) && styles.personSelected]} onPress={() => peopleSelecting ? togglePeopleSelection(person.id) : setActivePerson({ person, editing: false })} accessibilityRole={peopleSelecting ? 'checkbox' : 'button'} accessibilityState={peopleSelecting ? { checked: selectedPeopleIds.includes(person.id) } : {}} accessibilityLabel={person.name}>
                        {peopleSelecting && <View style={[styles.checkBox, styles.peopleCardCheck, selectedPeopleIds.includes(person.id) && styles.checkBoxDone]}>{selectedPeopleIds.includes(person.id) && <AppIcon name="check" size={15} />}</View>}
                        <PersonPhoto person={person} size={largePeopleView ? 112 : 66} />
                        <Text style={styles.personCardName} numberOfLines={1}>{person.name}</Text>
                        {person.isCommander && <Pill label="מפקד" tone="blue" />}
                        <Text style={styles.personCardRole} numberOfLines={1}>{person.role || 'תפקיד לא צוין'}</Text>
                        <Pill label={person.status} tone={person.status === 'במסגרת' ? 'green' : 'orange'} />
                        {!!person.statusTags.length && (
                          <View style={styles.statusTagRow}>
                            {person.statusTags.slice(0, 2).map((tag) => <Pill key={tag} label={tag} tone="neutral" />)}
                            {person.statusTags.length > 2 && <Pill label={`+${person.statusTags.length - 2}`} tone="neutral" />}
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
                  </View>;
                })}
              </View>
              {filteredPeople.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyText}>לא מצאתי שם כזה.</Text></View>}
              <Text style={styles.bottomHint}>{peopleSelecting ? 'לחץ על הכרטיסים שתרצה לסמן' : 'לחיצה על כרטיס פותחת את התיק האישי'}</Text>
            </>
          )}

          {tab === 'guards' && (
            <>
              <PageTitle eyebrow="תכנון יומי" title="שבצ״ק" caption="עמודות הן עמדות, שורות הן שעות" />
              <View style={styles.dateStrip}><Text style={styles.dateStripDay}>היום</Text><Text style={styles.dateStripDate}>{new Intl.DateTimeFormat('he-IL', { day: 'numeric' }).format(new Date())}</Text><Text style={styles.dateStripMonth}>{new Intl.DateTimeFormat('he-IL', { month: 'long' }).format(new Date())}</Text><View style={styles.dateStripSpacer} /><Pill label={`${guardPosts.length} עמדות`} tone="orange" /><Pill label={`${guardTimeSlots.length} שעות`} tone="neutral" /></View>
              <Pressable style={styles.shareGuardButton} onPress={shareGuardRoster}>
                <AppIcon name="share" size={17} color={C.ink} />
                <Text style={styles.shareGuardText}>{rosterCopied ? 'הועתק — אפשר להדביק בוואטסאפ' : Platform.OS === 'web' ? 'העתקת שבצ״ק לוואטסאפ' : 'שיתוף או העתקה לוואטסאפ'}</Text>
              </Pressable>
              <View style={styles.infoBanner}><AppIcon name="clock" size={17} color={C.orange} /><Text style={styles.infoBannerText}>בכל תא בוחרים אדם. לחצו על שעה לעריכה או על כותרת עמדה לפתיחת התיק שלה.</Text></View>
              <View style={styles.guardMatrix}>
                <View style={styles.guardHoursColumn}>
                  <View style={styles.guardHoursHeader}><Text style={styles.guardMatrixHeaderText}>שעות</Text></View>
                  {guardTimeSlots.map((slot) => {
                    const { start, end } = getShiftTimes(slot.time);
                    return (
                      <View key={slot.id} style={styles.guardHourCell}>
                        <Pressable style={styles.guardHourButton} onPress={() => setTimePicker({ slotId: slot.id, part: 'start', value: start })}><Text style={styles.guardHourText}>{start}</Text></Pressable>
                        <Text style={styles.guardHourDash}>–</Text>
                        <Pressable style={styles.guardHourButton} onPress={() => setTimePicker({ slotId: slot.id, part: 'end', value: end })}><Text style={styles.guardHourText}>{end}</Text></Pressable>
                      </View>
                    );
                  })}
                </View>
                <ScrollView horizontal style={styles.guardPostsScroll} contentContainerStyle={styles.guardPostsRow} showsHorizontalScrollIndicator>
                  {guardPosts.map((post) => (
                    <View key={post.id} style={styles.guardPostColumnView}>
                      <Pressable style={styles.guardPostHeader} onPress={() => setEditingGuard(post)}>
                        <Text style={styles.guardPostHeaderName} numberOfLines={1}>{post.place}</Text>
                        <Text style={styles.guardPostHeaderHint}>תיק עמדה</Text>
                      </Pressable>
                      {guardTimeSlots.map((slot) => {
                        const assignment = guardAssignments.find((item) => item.postId === post.id && item.slotId === slot.id);
                        const person = assignment ? getPerson(assignment.personId, people) : null;
                        return (
                          <Pressable
                            key={`${slot.id}-${post.id}`}
                            style={[styles.guardAssignmentCell, !!person && styles.guardAssignmentCellFilled]}
                            onPress={() => setPeoplePickerCell({ postId: post.id, slotId: slot.id })}
                          >
                            {person ? <Text style={styles.guardAssignmentName} numberOfLines={2}>{person.name}</Text> : <Text style={styles.guardAssignmentEmpty}>＋ בוחרים אדם</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                  {guardPosts.length === 0 && <Text style={styles.emptyText}>הוסיפו עמדה כדי להתחיל.</Text>}
                </ScrollView>
              </View>
              <View style={styles.guardMatrixActions}>
                <Pressable style={[styles.addGuardButton, styles.addGuardAction]} onPress={addGuard}><AppIcon name="plus" size={15} color={C.purple} /><Text style={styles.addGuardText}>הוספת עמדה</Text></Pressable>
                <Pressable style={[styles.addGuardButton, styles.addGuardAction]} onPress={addGuardTimeSlot}><AppIcon name="plus" size={15} color={C.purple} /><Text style={styles.addGuardText}>הוספת שעות</Text></Pressable>
              </View>
              <View style={styles.demoNote}><AppIcon name="sparkle" size={14} color={C.violet} /><Text style={styles.demoNoteText}>הטבלה להדגמה. אפשר לגלול לצדדים כשמוסיפים עמדות נוספות.</Text></View>
              <SectionHeading title="כפכ״פ — כיתת כוננות" />
              <Text style={styles.sheetIntro}>בכל שורת שעות: ארבעה לוחמים ומפקד אחד. אפשר לגלול את הטבלה לצדדים. את השעות משנים בלחיצה עליהן.</Text>
              {!people.some((person) => person.isCommander) && <Pressable style={styles.peopleActionButton} onPress={() => { setPeopleFilter('all'); setSearch(''); setTab('people'); }}><Text style={styles.peopleActionText}>כדי לבחור מפקד, סמן אותו כמפקד בתיק האישי באנשים</Text></Pressable>}
              <View style={[styles.guardMatrix, { marginTop: 12 }]}>
                <View style={styles.guardHoursColumn}>
                  <View style={styles.guardHoursHeader}><Text style={styles.guardMatrixHeaderText}>שעות</Text></View>
                  {readinessShifts.map((shift) => {
                    const { start, end } = getShiftTimes(shift.time);
                    return <View key={shift.id} style={styles.guardHourCell}>
                      <Pressable style={styles.guardHourButton} accessibilityLabel={`תחילת כוננות ${start}`} onPress={() => setTimePicker({ slotId: shift.id, part: 'start', value: start, target: 'readiness' })}><Text style={styles.guardHourText}>{start}</Text></Pressable>
                      <Text style={styles.guardHourDash}>–</Text>
                      <Pressable style={styles.guardHourButton} accessibilityLabel={`סיום כוננות ${end}`} onPress={() => setTimePicker({ slotId: shift.id, part: 'end', value: end, target: 'readiness' })}><Text style={styles.guardHourText}>{end}</Text></Pressable>
                    </View>;
                  })}
                </View>
                <ScrollView horizontal style={styles.guardPostsScroll} contentContainerStyle={styles.guardPostsRow} showsHorizontalScrollIndicator>
                  {Array.from({ length: 5 }, (_, column) => {
                    const commander = column === 0;
                    const label = commander ? 'מפקד' : readinessFighterLabels[column - 1];
                    return <View key={`readiness-column-${column}`} style={styles.guardPostColumnView}>
                      <Pressable style={styles.guardPostHeader} disabled={commander} accessibilityRole={commander ? 'header' : 'button'} accessibilityLabel={commander ? label : `עריכת כותרת ${label}`} onPress={() => setEditingReadinessLabel({ index: column - 1, value: label })}>
                        <Text style={styles.readinessHeaderText} numberOfLines={2}>{label}</Text>
                      </Pressable>
                      {readinessShifts.map((shift) => {
                        const personId = commander ? shift.commanderId : shift.fighterIds[column - 1];
                        const person = people.find((item) => item.id === personId);
                        return <Pressable key={shift.id} style={[styles.guardAssignmentCell, !!person && styles.guardAssignmentCellFilled]} accessibilityRole="button" accessibilityLabel={`${label}, ${shift.time}, ${person?.name ?? 'לא שובץ'}`} onPress={() => setReadinessPicker({ shiftId: shift.id, role: commander ? 'commander' : 'fighter', fighterIndex: commander ? undefined : column - 1 })}>
                          <Text style={person ? styles.guardAssignmentName : styles.guardAssignmentEmpty} numberOfLines={2}>{person?.name ?? `＋ בחירת ${commander ? 'מפקד' : 'לוחם'}`}</Text>
                        </Pressable>;
                      })}
                    </View>;
                  })}
                </ScrollView>
              </View>
              {readinessShifts.length === 0 && <Text style={styles.emptyText}>הוסף שעות כדי להתחיל לשבץ את כיתת הכוננות.</Text>}
              <Pressable style={styles.addGuardButton} onPress={addReadinessShift}><AppIcon name="plus" size={15} color={C.violetLight} /><Text style={styles.addGuardText}>הוספת שעות לכיתת הכוננות</Text></Pressable>
            </>
          )}

          {tab === 'roster' && (
            <>
              <PageTitle eyebrow="תמונת כוח" title="מצבת לוחמים" caption={`${rosterRows.length} אנשים · ${presentRosterCount} נוכחים · ${absentRosterCount} לא נוכחים`} />
              <View style={styles.rosterTopActions}>
                <Text style={styles.rosterTopHint}>עדכון נוכחות ומיקום</Text>
                <Pressable style={styles.rosterSettingsButton} onPress={() => setRosterSettingsOpen(true)}>
                  <Text style={styles.rosterSettingsButtonText}>עריכת סיבות ובסיסים</Text>
                  <AppIcon name="settings" size={16} color={C.purple} />
                </Pressable>
              </View>
              {selectedRosterIds.length > 0 && (
                <View style={styles.rosterBulkToolbar}>
                  <View style={styles.rosterBulkActions}>
                    <Pressable style={styles.rosterBulkButton} onPress={() => setBulkRosterOpen(true)}>
                      <Text style={styles.rosterBulkButtonText}>עדכון מסומנים</Text>
                    </Pressable>
                    <Pressable style={styles.rosterClearSelection} onPress={() => setSelectedRosterIds([])}>
                      <Text style={styles.rosterClearSelectionText}>ביטול סימון</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.rosterSelectedCount}>{selectedRosterIds.length} נבחרו</Text>
                </View>
              )}
              {rosterRows.map(({ person, entry }) => {
                const selected = selectedRosterIds.includes(person.id);
                return (
                  <View key={person.id} style={[styles.rosterPersonCard, selected && styles.rosterPersonCardSelected]}>
                    <View style={styles.rosterPersonTop}>
                      <Pressable
                        style={[styles.rosterCheckbox, selected && styles.rosterCheckboxSelected]}
                        onPress={() => toggleRosterSelection(person.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`בחירת ${person.name}`}
                      >
                        {selected && <AppIcon name="check" size={14} color={C.ink} />}
                      </Pressable>
                      <View style={styles.rosterPersonInfo}>
                        <Text style={styles.rosterPersonName}>{person.name || 'שם לא הוגדר'}</Text>
                        <Text style={styles.rosterPersonRole}>פק״ל · {person.role || 'לא הוגדר'}</Text>
                      </View>
                      <Pill label={entry.attendance} tone={entry.attendance === 'נוכח' ? 'green' : 'orange'} />
                    </View>
                    <View style={styles.rosterFieldsRow}>
                      <View style={styles.rosterField}>
                        <Text style={styles.rosterFieldLabel}>נוכחות</Text>
                        <Pressable
                          style={[styles.rosterValueButton, entry.attendance === 'נוכח' && styles.rosterValueButtonActive]}
                          onPress={() => setRosterChoice({ personId: person.id, field: 'attendance' })}
                          accessibilityLabel={`עדכון נוכחות של ${person.name}`}
                        >
                          <Text style={[styles.rosterValueText, entry.attendance === 'נוכח' && styles.rosterValueTextActive]}>{entry.attendance}</Text>
                          <AppIcon name="chevronDown" size={13} color={C.muted} />
                        </Pressable>
                      </View>
                      <View style={styles.rosterField}>
                        <Text style={styles.rosterFieldLabel}>בסיס</Text>
                        {entry.attendance === 'נוכח' ? (
                          <Pressable
                            style={styles.rosterValueButton}
                            onPress={() => setRosterChoice({ personId: person.id, field: 'base' })}
                            accessibilityLabel={`עדכון בסיס של ${person.name}`}
                          >
                            <Text style={styles.rosterValueText}>{entry.base || 'בחירת בסיס'}</Text>
                            <AppIcon name="chevronDown" size={13} color={C.muted} />
                          </Pressable>
                        ) : (
                          <View style={[styles.rosterValueButton, styles.rosterValueDisabled]}><Text style={styles.rosterDisabledText}>לא נוכח בבסיס</Text></View>
                        )}
                      </View>
                    </View>
                    {entry.attendance === 'לא נוכח' && (
                      <View style={styles.rosterReasonField}>
                        <Text style={styles.rosterFieldLabel}>סיבת היעדרות</Text>
                        <Pressable
                          style={styles.rosterValueButton}
                          onPress={() => setRosterChoice({ personId: person.id, field: 'reason' })}
                          accessibilityLabel={`בחירת סיבת היעדרות עבור ${person.name}`}
                        >
                          <Text style={[styles.rosterValueText, !entry.reason && styles.rosterPlaceholder]}>{entry.reason || 'בחירת סיבה'}</Text>
                          <AppIcon name="chevronDown" size={13} color={C.muted} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              {rosterRows.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyText}>הוסיפו אנשים במסך „אנשים” כדי לבנות את המצבה.</Text></View>}
              <View style={styles.demoNote}><AppIcon name="sparkle" size={14} color={C.violet} /><Text style={styles.demoNoteText}>השמות והפרטים נלקחים ממסך „אנשים”. אפשר לסמן כמה אנשים ולעדכן להם נוכחות או בסיס יחד.</Text></View>
            </>
          )}

          {activeDomain && (
            <>
              <PageTitle title={activeDomain.title} caption="תחום חדש — בשלב התכנון" />
              <View style={styles.domainPlaceholder}>
                <View style={styles.domainPlaceholderIcon}><AppIcon name={activeDomain.icon} size={42} color={C.navigationPurple} /></View>
                <Text style={styles.domainPlaceholderTitle}>{activeDomain.title}</Text>
                <Text style={styles.domainPlaceholderText}>{activeDomain.description}</Text>
                <Text style={styles.domainPlaceholderHint}>כאן נוסיף את התוכן והפעולות לאחר שנסגור יחד את התכנון.</Text>
                <Pressable style={styles.peopleActionButton} onPress={() => setQuickActionsOpen(true)} accessibilityRole="button"><Text style={styles.peopleActionText}>חזרה לתפריט השועל</Text></Pressable>
              </View>
            </>
          )}
          {tab === 'tasks' && (
            <>
              <PageTitle eyebrow="הדברים שלך" title="המשימות שלי" caption="מסודרות לפי דחיפות, חשיבות ומועד" />
              <View style={styles.taskSummary}><View><Text style={styles.taskSummaryNumber}>{openTaskCount}</Text><Text style={styles.taskSummaryLabel}>משימות נשארו</Text></View><View style={styles.taskSummaryIcon}><AppIcon name="tasks" size={22} color={C.ink} /></View></View>
              <View style={styles.taskActionRow}><Text style={styles.sectionTitle}>רשימת משימות</Text><Pressable onPress={() => setTaskModalOpen(true)} style={styles.addButton}><AppIcon name="plus" size={14} color={C.ink} /><Text style={styles.addButtonText}>משימה חדשה</Text></Pressable></View>
              {sortedTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} />)}
              {tasks.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyText}>עוד אין משימות. נוסיף את הראשונה?</Text></View>}
              <View style={styles.priorityHint}><Text style={styles.priorityHintTitle}>איך נקבעת העדיפות?</Text><Text style={styles.priorityHintBody}>משימה דחופה וחשובה תופיע ראשונה. תאריך היעד עוזר לך לראות מה מתקרב.</Text></View>
            </>
          )}
        </ScrollView>
        </Animated.View>

        {saveState !== 'saved' && <Pressable style={styles.storageBar} onPress={() => setBackupOpen(true)} accessibilityRole="button" accessibilityLabel="מצב שמירה, גיבוי ושחזור">
          <Text accessibilityLiveRegion="polite" style={[styles.storageBarText, styles.peopleDeleteText]}>
            {saveState === 'blocked' ? 'לא ניתן לפתוח את השמירה · פרטים ושחזור' : saveState === 'unavailable' ? 'השמירה במכשיר אינה זמינה · פרטים' : 'השמירה נכשלה · פתח לגיבוי'}
          </Text>
        </Pressable>}
        <View nativeID="app-bottom-navigation" style={styles.tabBar}>
          <Svg pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs><LinearGradient id="navigationSurface" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#171219" /><Stop offset="1" stopColor="#0D080C" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#navigationSurface)" />
          </Svg>
          <TabButton icon="home" label="בית" active={tab === 'home'} onPress={() => setTab('home')} />
          <TabButton icon="calendar" label="מצבה" active={tab === 'roster'} onPress={() => setTab('roster')} />
          <View style={styles.navigationAddSlot}>
            <Pressable style={({ pressed }) => [styles.navigationAddButton, pressed && styles.navigationAddPressed]} onPress={() => setQuickActionsOpen(true)} accessibilityRole="button" accessibilityLabel="תפריט השועל — תחומים ופעולות" accessibilityState={{ expanded: quickActionsOpen }}>
              <Svg pointerEvents="none" aria-hidden width="54" height="54" style={[StyleSheet.absoluteFill, styles.navigationButtonBackground]}>
                <Defs><LinearGradient id="navigationAddPurple" x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor={C.navigationGradientTop} /><Stop offset="1" stopColor={C.navigationGradientBottom} /></LinearGradient></Defs>
                <Circle cx="27" cy="27" r="26.5" fill="url(#navigationAddPurple)" stroke="#9C50CE" strokeWidth="0.7" />
              </Svg>
              <View pointerEvents="none" style={styles.navigationFoxIcon}><AppIcon name="fox" size={35} color="#F5EDF9" /></View>
            </Pressable>
          </View>
          <TabButton icon="shield" label="שמירות" active={tab === 'guards'} onPress={() => setTab('guards')} />
          <TabButton icon="profile" label="אנשים" active={tab === 'people'} onPress={() => setTab('people')} />
        </View>
      </View>

      <Sheet visible={quickActionsOpen} onClose={() => setQuickActionsOpen(false)}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>תחומים ופעולות</Text><Pressable style={styles.closeButton} onPress={() => setQuickActionsOpen(false)} accessibilityLabel="סגירת הפעולות"><AppIcon name="close" size={16} /></Pressable></View>
        <ScrollView style={styles.personSheetScroll} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <View style={styles.domainMenuGrid}>
          {plannedDomains.map((domain) => <Pressable key={domain.key} style={({ pressed }) => [styles.domainMenuCard, pressed && styles.pressedControl]} onPress={() => { setQuickActionsOpen(false); setTab(domain.key); }} accessibilityRole="button" accessibilityLabel={domain.title}>
            <AppIcon name={domain.icon} color={C.navigationPurple} size={26} /><Text style={styles.domainMenuText}>{domain.title}</Text>
          </Pressable>)}
          <Pressable style={({ pressed }) => [styles.domainMenuCard, pressed && styles.pressedControl]} onPress={() => { setQuickActionsOpen(false); setTab('tasks'); }} accessibilityRole="button"><AppIcon name="taskCircle" color={C.navigationPurple} size={26} /><Text style={styles.domainMenuText}>משימות</Text></Pressable>
        </View>
        <Text style={styles.formLabel}>פעולות</Text>
        <Pressable style={styles.navigationAction} onPress={() => { setQuickActionsOpen(false); beginNewPerson(); }} accessibilityRole="button"><AppIcon name="people" color={C.navigationPurple} size={24} /><Text style={styles.navigationActionText}>הוספת אדם</Text></Pressable>
        <Pressable style={styles.navigationAction} onPress={() => { setQuickActionsOpen(false); setTaskModalOpen(true); }} accessibilityRole="button"><AppIcon name="tasks" color={C.navigationPurple} size={24} /><Text style={styles.navigationActionText}>הוספת משימה</Text></Pressable>
        <Pressable style={styles.navigationAction} onPress={() => { setQuickActionsOpen(false); setBackupOpen(true); }} accessibilityRole="button"><AppIcon name="share" color={C.navigationPurple} size={24} /><View><Text style={styles.navigationActionText}>גיבוי ושחזור</Text><Text style={styles.navigationActionHint}>{saveState === 'saved' ? 'השינויים נשמרים במכשיר הזה' : 'בדיקת מצב השמירה'}</Text></View></Pressable>
        </ScrollView>
      </Sheet>
      <Sheet visible={backupOpen} onClose={() => { setBackupOpen(false); setPendingRestore(null); }}>
        <ScrollView style={styles.personSheetScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>שמירה, גיבוי ושחזור</Text>
            <Pressable style={styles.closeButton} onPress={() => { setBackupOpen(false); setPendingRestore(null); }} accessibilityLabel="סגירת חלון הגיבוי"><AppIcon name="close" size={15} /></Pressable>
          </View>
          <Text style={styles.backupExplanation}>המידע נשמר אוטומטית בדפדפן שבמכשיר הזה. פתיחה באותו דפדפן ובאותה כתובת תחזיר את המידע ששמרת. יש להשתמש בגלישה רגילה; מידע בגלישה פרטית עלול להימחק בסגירה.</Text>
          <Text style={styles.backupExplanation}>לפני החלפת כתובת התצוגה הזמנית, מעבר למכשיר אחר או ניקוי נתוני הדפדפן, הורד גיבוי. בכתובת החדשה אפשר לשחזר אותו.</Text>
          {saveState === 'blocked' && <Text style={styles.peopleDeleteText}>לא הצלחתי לקרוא את השמירה הקיימת. לא דרסתי אותה. אפשר לייצא את המקור ולשחזר קובץ גיבוי תקין.</Text>}
          {saveState === 'error' && <Text style={styles.peopleDeleteText}>השינוי האחרון לא נשמר. ייתכן שהאחסון מלא או שהדפדפן חוסם שמירה. הורד גיבוי לפני יציאה.</Text>}
          {saveState === 'unavailable' && <Text style={styles.peopleDeleteText}>השמירה הזו זמינה בגרסת הדפדפן. גרסת התקנה תצטרך אחסון נפרד לפני שימוש קבוע.</Text>}
          {Platform.OS === 'web' && <>
            <Pressable style={styles.primaryButton} onPress={() => downloadBackup()}><Text style={styles.primaryButtonText}>הורדת גיבוי של המידע</Text></Pressable>
            {stored.kind === 'error' && stored.raw !== undefined && <Pressable style={styles.peopleActionButton} onPress={() => downloadBackup(stored.raw, 'original-save')}><Text style={styles.peopleActionText}>ייצוא השמירה המקורית לבדיקה</Text></Pressable>}
            {!pendingRestore ? <Pressable style={[styles.peopleActionButton, { marginTop: 10 }]} onPress={chooseBackup}><Text style={styles.peopleActionText}>בחירת קובץ לשחזור</Text></Pressable> : <View style={styles.personStatusDetail}>
              <Text style={styles.formLabel}>להחליף את המידע הקיים בגיבוי?</Text>
              <Text style={styles.backupExplanation}>הגיבוי כולל {pendingRestore.people.length} אנשים ו־{pendingRestore.tasks.length} משימות. השחזור יחליף גם את המצבה, השמירות וההגדרות. אפשר להוריד קודם גיבוי של המידע הנוכחי.</Text>
              <Pressable style={styles.primaryButton} onPress={restoreBackup}><Text style={styles.primaryButtonText}>כן, לשחזר ולהחליף</Text></Pressable>
              <Pressable style={[styles.peopleActionButton, { marginTop: 10 }]} onPress={() => setPendingRestore(null)}><Text style={styles.peopleActionText}>ביטול השחזור</Text></Pressable>
            </View>}
          </>}
          {!!backupMessage && <Text style={[styles.backupExplanation, { marginTop: 12 }]} accessibilityLiveRegion="polite">{backupMessage}</Text>}
        </ScrollView>
      </Sheet>
      <PersonModal
        profile={activePerson}
        people={people}
        onClose={() => setActivePerson(null)}
        onEdit={() => setActivePerson((current) => current ? { ...current, editing: true } : null)}
        onSave={savePerson}
      />
      <Sheet visible={deletePeopleOpen} onClose={() => setDeletePeopleOpen(false)}>
        <Text style={styles.modalTitle}>מחיקת {selectedPeopleIds.length} אנשים?</Text>
        <Text style={styles.sheetIntro}>האנשים המסומנים יימחקו מהרשימה, מהמצבה ומשיבוצי השמירות והכוננות שלהם.</Text>
        <ScrollView style={{ maxHeight: 150 }}>{people.filter((person) => selectedPeopleIds.includes(person.id)).map((person) => <Text key={person.id} style={styles.formLabel}>{person.name}</Text>)}</ScrollView>
        <Pressable style={[styles.primaryButton, styles.peopleDeleteButton]} onPress={deleteSelectedPeople}><Text style={styles.peopleDeleteText}>כן, למחוק</Text></Pressable>
        <Pressable style={styles.primaryButton} onPress={() => setDeletePeopleOpen(false)}><Text style={styles.primaryButtonText}>ביטול</Text></Pressable>
      </Sheet>
      <Sheet visible={assistantInfoOpen} onClose={() => setAssistantInfoOpen(false)}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>האסיסטנט שלך</Text><Pressable onPress={() => setAssistantInfoOpen(false)} style={styles.closeButton} accessibilityLabel="סגירת חלון האסיסטנט"><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
        <Text style={styles.sheetIntro}>כאן נוכל לחבר בהמשך עוזר AI לבחירתך. כרגע זהו אזור תצוגה בלבד; החיבור וההרשאות ייקבעו בנפרד.</Text>
        <Pressable style={styles.primaryButton} onPress={() => setAssistantInfoOpen(false)}><Text style={styles.primaryButtonText}>הבנתי</Text></Pressable>
      </Sheet>
      <GuardModal
        shift={editingGuard}
        onClose={() => setEditingGuard(null)}
        onSave={saveGuard}
      />
      <PeoplePickerModal
        visible={!!peoplePickerCell}
        people={people}
        selectedPersonId={guardAssignments.find((item) => item.postId === peoplePickerCell?.postId && item.slotId === peoplePickerCell?.slotId)?.personId ?? ''}
        onSelect={(personId) => peoplePickerCell && assignPerson(peoplePickerCell, personId)}
        onClose={() => setPeoplePickerCell(null)}
      />
      <PeoplePickerModal
        visible={!!readinessPicker}
        title={readinessPicker?.role === 'commander' ? 'בחירת מפקד לכוננות' : 'בחירת לוחם לכוננות'}
        emptyMessage={readinessPicker?.role === 'commander' ? 'אין מפקד פנוי לבחירה. מסמנים מפקדים בעריכת התיק האישי במסך אנשים.' : 'אין לוחמים פנויים נוספים בשורה הזו. אפשר להוסיף לוחם דרך מסך אנשים.'}
        people={readinessCandidates}
        selectedPersonId={readinessPicker?.role === 'commander' ? activeReadinessShift?.commanderId ?? '' : activeReadinessShift?.fighterIds[readinessPicker?.fighterIndex ?? 0] ?? ''}
        onSelect={assignReadiness}
        onClose={() => setReadinessPicker(null)}
      />
      <TimePickerModal
        value={timePicker?.value ?? '08:00'}
        visible={!!timePicker}
        title={timePicker?.part === 'start' ? 'שעת התחלה' : 'שעת סיום'}
        onClose={() => setTimePicker(null)}
        onSave={saveGuardTime}
      />
      <Sheet visible={!!editingReadinessLabel} onClose={() => setEditingReadinessLabel(null)}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>עריכת כותרת לוחם</Text><Pressable style={styles.closeButton} onPress={() => setEditingReadinessLabel(null)} accessibilityLabel="סגירת עריכת הכותרת"><AppIcon name="close" size={16} /></Pressable></View>
        <Text style={styles.formLabel}>כותרת המשבצת</Text>
        <TextInput value={editingReadinessLabel?.value ?? ''} onChangeText={(value) => setEditingReadinessLabel((current) => current ? { ...current, value } : null)} maxLength={30} style={styles.formInput} textAlign="right" placeholder="למשל: לוחם 1 או תפקיד" placeholderTextColor={C.muted} accessibilityLabel="כותרת משבצת הלוחם" />
        <Text style={styles.sheetIntro}>שינוי הכותרת משאיר את האנשים שכבר משובצים בעמודה.</Text>
        <Pressable disabled={!editingReadinessLabel?.value.trim()} style={[styles.primaryButton, !editingReadinessLabel?.value.trim() && styles.primaryButtonDisabled]} onPress={() => { if (!editingReadinessLabel?.value.trim()) return; setReadinessFighterLabels((current) => current.map((label, index) => index === editingReadinessLabel.index ? editingReadinessLabel.value.trim() : label)); setEditingReadinessLabel(null); }}><Text style={styles.primaryButtonText}>שמירת הכותרת</Text></Pressable>
      </Sheet>
      <TaskModal
        visible={taskModalOpen}
        title={taskTitle}
        due={taskDue}
        urgency={taskUrgency}
        importance={taskImportance}
        onChangeTitle={setTaskTitle}
        onChangeDue={setTaskDue}
        onChangeUrgency={setTaskUrgency}
        onChangeImportance={setTaskImportance}
        onClose={() => setTaskModalOpen(false)}
        onSave={saveTask}
      />
      <RosterChoiceModal
        visible={!!rosterChoice}
        title={rosterChoice?.field === 'attendance' ? 'עדכון נוכחות' : rosterChoice?.field === 'reason' ? 'סיבת היעדרות' : 'בחירת בסיס'}
        options={rosterChoiceOptions}
        selectedValue={rosterChoiceValue}
        onSelect={saveRosterChoice}
        onClose={() => setRosterChoice(null)}
      />
      <RosterBulkModal
        visible={bulkRosterOpen}
        selectedCount={selectedRosterIds.length}
        field={bulkField}
        attendance={bulkAttendance}
        reason={bulkReason}
        base={bulkBase}
        reasons={absenceReasons}
        bases={baseOptions}
        onChangeField={setBulkField}
        onChangeAttendance={setBulkAttendance}
        onChangeReason={setBulkReason}
        onChangeBase={setBulkBase}
        onClose={() => setBulkRosterOpen(false)}
        onSave={applyRosterBulkUpdate}
      />
      <RosterSettingsModal
        visible={rosterSettingsOpen}
        reasons={absenceReasons}
        bases={baseOptions}
        onClose={() => setRosterSettingsOpen(false)}
        onSave={saveRosterSettings}
      />
    </SafeAreaView>
    </DavidFontLoadedContext.Provider>
  );
}

function TabButton({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabButton, pressed && styles.pressedControl]} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <View style={styles.tabIconWrap}><AppIcon name={icon} size={23} color={active ? C.navigationPurple : C.navigationMuted} filled={active && icon === 'home'} /></View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function TaskRow({ task, onToggle, last = false }: { task: TaskItem; onToggle: () => void; last?: boolean }) {
  return (
    <View style={[styles.taskRow, !last && styles.withTopBorder, task.done && styles.taskDone]}>
      <Pressable onPress={onToggle} style={[styles.checkBox, task.done && styles.checkBoxDone]} accessibilityLabel={task.done ? 'סימון כלא הושלמה' : 'סימון כהושלמה'}>
        {task.done && <AppIcon name="check" size={15} color={C.ink} />}
      </Pressable>
      <View style={styles.taskInfo}>
        <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
        <View style={styles.taskMeta}>
          <Pill label={task.urgency} tone={task.urgency === 'דחופה' ? 'red' : 'neutral'} />
          <Pill label={task.importance} tone={task.importance === 'חשובה' ? 'blue' : 'neutral'} />
          <Text style={styles.dueText}>{task.due}</Text>
        </View>
      </View>
    </View>
  );
}

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

function PersonModal({ profile, people, onClose, onEdit, onSave }: {
  profile: { person: Person; editing: boolean } | null;
  people: Person[];
  onClose: () => void;
  onEdit: () => void;
  onSave: (person: Person) => void;
}) {
  const [draft, setDraft] = useState<Person | null>(profile?.person ?? null);
  React.useEffect(() => setDraft(profile?.person ?? null), [profile?.person]);
  if (!profile || !draft) return null;

  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setDraft((current) => current ? { ...current, photoUri: result.assets[0].uri } : current);
      }
    } catch {
      Alert.alert('לא ניתן לבחור תמונה', 'נסה לבחור תמונה שוב.');
    }
  }

  if (profile.editing) {
    const duplicateName = people.some((person) => person.id !== draft.id && normalizedPersonName(person.name) === normalizedPersonName(draft.name));
    const canSave = !!draft.name.trim() && !duplicateName;
    return (
      <Sheet visible onClose={onClose}>
        <ScrollView style={styles.personSheetScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>{draft.id ? 'עריכת פרטים' : 'אדם חדש'}</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
        <View style={styles.photoEditorRow}>
          <PersonPhoto person={draft} size={78} />
          <View style={styles.photoEditorText}>
            <Text style={styles.formLabel}>תמונת פרופיל</Text>
            <Pressable style={styles.photoPickerButton} onPress={choosePhoto}><Text style={styles.photoPickerText}>{draft.photoUri ? 'החלפת תמונה' : 'בחירת תמונה'}</Text></Pressable>
          </View>
        </View>
        <Text style={styles.formLabel}>שם מלא</Text>
        <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="שם פרטי ומשפחה" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
        {duplicateName && <Text style={styles.peopleDeleteText}>השם כבר קיים ברשימה. אפשר לערוך את הכרטיס הקיים.</Text>}
        <ChoiceGroup label="קבוצה" options={personGroups.map((group) => group.label)} value={personGroups.find((group) => group.key === (draft.group ?? 'other'))!.label} onChange={(label) => setDraft({ ...draft, group: personGroups.find((group) => group.label === label)!.key })} />
        <ChoiceGroup label="סוג תפקיד" options={['לוחם', 'מפקד']} value={draft.isCommander ? 'מפקד' : 'לוחם'} onChange={(value) => setDraft({ ...draft, isCommander: value === 'מפקד' })} />
        <Text style={styles.formHint}>שינוי בין לוחם למפקד יפנה שיבוץ כפכ״פ שאינו מתאים לתפקיד החדש.</Text>
        <Text style={styles.formLabel}>עיר</Text>
        <TextInput value={draft.city} onChangeText={(city) => setDraft({ ...draft, city })} placeholder="למשל: חיפה" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
        <Text style={styles.formLabel}>תפקיד / פק״ל</Text>
        <TextInput value={draft.role} onChangeText={(role) => setDraft({ ...draft, role })} placeholder="תפקיד או תחום אחריות" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
        <Text style={styles.formLabel}>סטטוסים נוספים</Text>
        <TextInput
          value={draft.statusTags.join(', ')}
          onChangeText={(value) => setDraft({ ...draft, statusTags: value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
          placeholder="למשל: בסיס לדוגמה, תורנות, הכשרה, תחרות"
          placeholderTextColor={C.muted}
          style={styles.formInput}
          textAlign="right"
        />
        <Text style={styles.formHint}>מפרידים בין כמה סטטוסים בעזרת פסיק</Text>
        <ChoiceGroup
          label="סטטוס כללי"
          options={['במסגרת', 'בחופשה']}
          value={draft.status === 'בחופשה' ? 'בחופשה' : 'במסגרת'}
          onChange={(status) => setDraft({ ...draft, status })}
        />
        <Text style={styles.sectionTitle}>סטטוס אישי</Text>
        {personStatusFields.map(({ key, label }) => (
          <View key={key}>
            <Text style={styles.formLabel}>{label}</Text>
            <TextInput
              value={draft.statusDetails?.[key] ?? ''}
              onChangeText={(value) => setDraft({ ...draft, statusDetails: { ...draft.statusDetails, [key]: value } })}
              multiline
              textAlign="right"
              textAlignVertical="top"
              accessibilityLabel={`סטטוס ${label}`}
              placeholder={`הוסף פרטים בנושא ${label}`}
              placeholderTextColor={C.muted}
              style={[styles.formInput, styles.personStatusInput]}
            />
          </View>
        ))}
        <Pressable disabled={!canSave} style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]} onPress={() => onSave(draft)}><Text style={styles.primaryButtonText}>שמירת פרטים</Text></Pressable>
        <Text style={styles.sheetFootnote}>בדוק את מצב השמירה בתחתית המסך אחרי שמירת הפרטים</Text>
        </ScrollView>
      </Sheet>
    );
  }

  const person = profile.person;
  return (
    <Sheet visible onClose={onClose}>
      <ScrollView style={styles.personSheetScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>כרטיס אישי</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <View style={styles.profileTop}><PersonPhoto person={person} size={98} /><Text style={styles.profileName}>{person.name}</Text><Text style={styles.profileRole}>{person.role}</Text><Pill label={person.status} tone={person.status === 'במסגרת' ? 'green' : 'orange'} /></View>
      {!!person.statusTags.length && <View style={styles.profileStatusTags}>{person.statusTags.map((tag) => <Pill key={tag} label={tag} tone="neutral" />)}</View>}
      <View style={styles.profileDetails}>
        <DetailRow label="עיר" value={person.city || 'לא צוין'} />
        <DetailRow label="תפקיד / פק״ל" value={person.role || 'לא צוין'} />
        <DetailRow label="קבוצה" value={personGroups.find((group) => group.key === (person.group ?? 'other'))?.label ?? 'השאר'} />
        <DetailRow label="סוג תפקיד" value={person.isCommander ? 'מפקד' : 'לוחם'} />
        <DetailRow label="סטטוס" value={person.status} last />
      </View>
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>סטטוס אישי</Text>
      {personStatusFields.map(({ key, label }) => (
        <View key={key} style={styles.personStatusDetail}>
          <Text style={styles.formLabel}>{label}</Text>
          <Text style={styles.personStatusValue}>{person.statusDetails?.[key]?.trim() || 'טרם מולא'}</Text>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={onEdit}><Text style={styles.primaryButtonText}>עריכת פרטים</Text></Pressable>
      <Text style={styles.sheetFootnote}>אפשר לעדכן את התחומים דרך עריכת פרטים</Text>
      </ScrollView>
    </Sheet>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, !last && styles.withTopBorder]}><Text style={styles.detailValue}>{value}</Text><Text style={styles.detailLabel}>{label}</Text></View>;
}

function GuardModal({ shift, onClose, onSave }: { shift: GuardPost | null; onClose: () => void; onSave: (shift: GuardPost) => void }) {
  const [draft, setDraft] = useState<GuardPost | null>(shift);
  React.useEffect(() => setDraft(shift), [shift]);
  if (!shift || !draft) return null;
  return (
    <Sheet visible={!!shift} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>תיק עמדה</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.formLabel}>שם העמדה</Text>
      <TextInput value={draft.place} onChangeText={(place) => setDraft({ ...draft, place })} placeholder="למשל: עמדה א׳" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
      <Text style={styles.formLabel}>פרטים והערות</Text>
      <TextInput value={draft.details ?? ''} onChangeText={(details) => setDraft({ ...draft, details })} placeholder="אפשר להוסיף תיאור או הערה לעמדה" placeholderTextColor={C.muted} style={styles.guardDetailsInput} textAlign="right" multiline />
      <View style={styles.futureFields}><Text style={styles.futureFieldsTitle}>אפשר להוסיף כאן בהמשך</Text><Text style={styles.futureFieldsText}>ציוד · הנחיות · אנשי קשר · תזכורות</Text></View>
      <Pressable style={styles.primaryButton} onPress={() => onSave(draft)}><Text style={styles.primaryButtonText}>שמירת פרטי העמדה</Text></Pressable>
      <Text style={styles.sheetFootnote}>הפרטים נשמרים כרגע בזיכרון של האב־טיפוס</Text>
    </Sheet>
  );
}

function PeoplePickerModal({ visible, people, selectedPersonId, onSelect, onClose, title = 'בחירת שם', emptyMessage = 'עדיין אין אנשים ברשימה. אפשר להוסיף אנשים במסך ״אנשים״.' }: {
  visible: boolean;
  people: Person[];
  selectedPersonId: string;
  onSelect: (personId: string) => void;
  onClose: () => void;
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.sheetIntro}>בחרו אדם מתוך הרשימה שהוספתם במסך אנשים</Text>
      <ScrollView style={styles.peoplePickerList} showsVerticalScrollIndicator={false}>
        {people.map((person) => (
          <Pressable key={person.id} style={[styles.personChoice, selectedPersonId === person.id && styles.personChoiceActive]} onPress={() => onSelect(person.id)}>
            <Avatar person={person} size={38} /><Text style={styles.choiceName}>{person.name}</Text><Text style={styles.choiceRole}>{person.role}</Text>
            {selectedPersonId === person.id && <Text style={styles.choiceCheck}>✓</Text>}
          </Pressable>
        ))}
      </ScrollView>
      {people.length === 0 && <Text style={styles.emptyText}>{emptyMessage}</Text>}
      {!!selectedPersonId && <Pressable style={styles.clearAssigneeButton} onPress={() => onSelect('')}><Text style={styles.clearAssigneeText}>הסרת השיבוץ</Text></Pressable>}
    </Sheet>
  );
}

function WheelColumn({ label, values, selectedValue, onChange }: {
  label: string;
  values: string[];
  selectedValue: string;
  onChange: (value: string) => void;
}) {
  const scrollRef = React.useRef<ScrollView>(null);
  const initialIndex = Math.max(0, values.indexOf(selectedValue));
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialIndex * 42, animated: false });
  }, []);
  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.wheelScroll}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={42}
        decelerationRate="fast"
        onScroll={(event) => {
          const index = Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / 42)));
          if (values[index] !== selectedValue) onChange(values[index]);
        }}
        scrollEventThrottle={100}
      >
        {values.map((value) => (
          <View key={value} style={styles.wheelItem}><Text style={[styles.wheelItemText, selectedValue === value && styles.wheelItemTextActive]}>{value}</Text></View>
        ))}
      </ScrollView>
    </View>
  );
}

function TimePickerModal({ value, visible, title, onClose, onSave }: {
  value: string;
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [hour, setHour] = useState(value.split(':')[0] ?? '08');
  const [minute, setMinute] = useState(value.split(':')[1] ?? '00');
  React.useEffect(() => {
    setHour(value.split(':')[0] ?? '08');
    setMinute(value.split(':')[1] ?? '00');
  }, [value]);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.sheetIntro}>גללו בעמודות כדי לבחור שעה ודקה</Text>
      {visible && (
        <View style={styles.timeWheelWrap}>
          <WheelColumn label="שעה" values={hours} selectedValue={hour} onChange={setHour} />
          <Text style={styles.wheelColon}>:</Text>
          <WheelColumn label="דקות" values={minutes} selectedValue={minute} onChange={setMinute} />
          <View pointerEvents="none" style={styles.wheelSelection} />
        </View>
      )}
      <Text style={styles.selectedTimePreview}>{hour}:{minute}</Text>
      <Pressable style={styles.primaryButton} onPress={() => onSave(`${hour}:${minute}`)}><Text style={styles.primaryButtonText}>בחירת שעה</Text></Pressable>
    </Sheet>
  );
}

function ChoiceGroup<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.choiceGroupRow}>
        {options.map((option) => <Pressable key={option} style={[styles.choicePill, value === option && styles.choicePillActive]} onPress={() => onChange(option)}><Text style={[styles.choicePillText, value === option && styles.choicePillTextActive]}>{option}</Text></Pressable>)}
      </View>
    </View>
  );
}

function TaskModal({ visible, title, due, urgency, importance, onChangeTitle, onChangeDue, onChangeUrgency, onChangeImportance, onClose, onSave }: {
  visible: boolean;
  title: string;
  due: string;
  urgency: 'דחופה' | 'רגילה';
  importance: 'חשובה' | 'רגילה';
  onChangeTitle: (value: string) => void;
  onChangeDue: (value: string) => void;
  onChangeUrgency: (value: 'דחופה' | 'רגילה') => void;
  onChangeImportance: (value: 'חשובה' | 'רגילה') => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>משימה חדשה</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.formLabel}>מה צריך לעשות?</Text>
      <TextInput value={title} onChangeText={onChangeTitle} placeholder="שם המשימה" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
      <ChoiceGroup label="דחיפות" options={['דחופה', 'רגילה']} value={urgency} onChange={onChangeUrgency} />
      <ChoiceGroup label="חשיבות" options={['חשובה', 'רגילה']} value={importance} onChange={onChangeImportance} />
      <Text style={styles.formLabel}>תאריך יעד או תיאור קצר</Text>
      <TextInput value={due} onChangeText={onChangeDue} placeholder="למשל: היום או יום ראשון" placeholderTextColor={C.muted} style={styles.formInput} textAlign="right" />
      <Pressable style={[styles.primaryButton, !title.trim() && styles.primaryButtonDisabled]} onPress={onSave}><Text style={styles.primaryButtonText}>הוספת משימה</Text></Pressable>
    </Sheet>
  );
}

function RosterChoiceModal({ visible, title, options, selectedValue, onSelect, onClose }: {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <ScrollView style={styles.rosterChoiceList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {options.map((option) => {
          const selected = option === selectedValue;
          return (
            <Pressable key={option} style={[styles.rosterChoiceOption, selected && styles.rosterChoiceOptionSelected]} onPress={() => onSelect(option)}>
              <Text style={[styles.rosterChoiceOptionText, selected && styles.rosterChoiceOptionTextSelected]}>{option}</Text>
              <View style={[styles.rosterChoiceRadio, selected && styles.rosterChoiceRadioSelected]}>{selected && <View style={styles.rosterChoiceRadioDot} />}</View>
            </Pressable>
          );
        })}
        {options.length === 0 && <Text style={styles.emptyText}>אין אפשרויות עדיין. אפשר להוסיף אותן בעריכת הרשימות.</Text>}
      </ScrollView>
    </Sheet>
  );
}

function RosterBulkModal({ visible, selectedCount, field, attendance, reason, base, reasons, bases, onChangeField, onChangeAttendance, onChangeReason, onChangeBase, onClose, onSave }: {
  visible: boolean;
  selectedCount: number;
  field: RosterBulkField;
  attendance: Attendance;
  reason: string;
  base: string;
  reasons: string[];
  bases: string[];
  onChangeField: (value: RosterBulkField) => void;
  onChangeAttendance: (value: Attendance) => void;
  onChangeReason: (value: string) => void;
  onChangeBase: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>עדכון {selectedCount} מסומנים</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.sheetIntro}>בחר מה לעדכן. השינוי יוחל על כל מי שסימנת.</Text>
      <ChoiceGroup label="סוג עדכון" options={['נוכחות', 'בסיס']} value={field === 'attendance' ? 'נוכחות' : 'בסיס'} onChange={(value) => onChangeField(value === 'נוכחות' ? 'attendance' : 'base')} />
      {field === 'attendance' ? (
        <>
          <ChoiceGroup<Attendance> label="נוכחות" options={['נוכח', 'לא נוכח']} value={attendance} onChange={onChangeAttendance} />
          {attendance === 'לא נוכח' && <ChoiceGroup<string> label="סיבת היעדרות" options={reasons} value={reason} onChange={onChangeReason} />}
        </>
      ) : <ChoiceGroup<string> label="בסיס" options={bases} value={base} onChange={onChangeBase} />}
      <Pressable style={styles.primaryButton} onPress={onSave}><Text style={styles.primaryButtonText}>החלת העדכון</Text></Pressable>
    </Sheet>
  );
}

function RosterSettingsModal({ visible, reasons, bases, onClose, onSave }: {
  visible: boolean;
  reasons: string[];
  bases: string[];
  onClose: () => void;
  onSave: (reasons: string[], bases: string[]) => void;
}) {
  const [reasonsText, setReasonsText] = useState(reasons.join('\n'));
  const [basesText, setBasesText] = useState(bases.join('\n'));
  React.useEffect(() => {
    if (!visible) return;
    setReasonsText(reasons.join('\n'));
    setBasesText(bases.join('\n'));
  }, [visible, reasons, bases]);

  function parseOptions(value: string) {
    return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
  }

  const parsedReasons = parseOptions(reasonsText);
  const parsedBases = parseOptions(basesText);
  const canSave = parsedReasons.length > 0 && parsedBases.length > 0;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}><Text style={styles.modalTitle}>עריכת סיבות ובסיסים</Text><Pressable onPress={onClose} style={styles.closeButton}><AppIcon name="close" size={15} color={C.muted} /></Pressable></View>
      <Text style={styles.sheetIntro}>אפשר לשנות שמות, להוסיף או למחוק. כתבו כל אפשרות בשורה נפרדת.</Text>
      <Text style={styles.formLabel}>סיבות היעדרות</Text>
      <TextInput value={reasonsText} onChangeText={setReasonsText} multiline textAlign="right" textAlignVertical="top" style={[styles.formInput, styles.rosterSettingsInput]} placeholder="למשל: חופשה שנתית" placeholderTextColor={C.muted} />
      <Text style={styles.formLabel}>בסיסים</Text>
      <TextInput value={basesText} onChangeText={setBasesText} multiline textAlign="right" textAlignVertical="top" style={[styles.formInput, styles.rosterSettingsInput]} placeholder="למשל: בסיס 1" placeholderTextColor={C.muted} />
      <Pressable style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]} disabled={!canSave} onPress={() => onSave(parsedReasons, parsedBases)}><Text style={styles.primaryButtonText}>שמירת האפשרויות</Text></Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  appFrame: { flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: C.background },
  screenTransition: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  homeScrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: spacing.md },
  homeHero: { position: 'relative', overflow: 'hidden', minHeight: 165, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: C.background },
  homeMountainImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 1 },
  homeMountainFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, flexDirection: 'column' },
  homeMountainFadeStep: { flex: 1 },
  homeBrandCopy: { alignItems: 'flex-end', justifyContent: 'center', marginRight: 9 },
  homeMotto: { color: '#E3D2EF', fontSize: 14, lineHeight: 17, marginTop: 1 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.xl },
  brandMark: { width: 34, height: 34, borderRadius: radius.control, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', shadowColor: C.violet, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 },
  brandMarkText: { color: C.ink, fontSize: 19, fontWeight: '800' },
  brandName: { color: C.ink, fontSize: 15, fontWeight: '700' },
  topBarSpacer: { flex: 1 },
  topIconButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  topIcon: { color: C.ink, fontSize: 26, lineHeight: 30 },
  greetingBlock: { alignItems: 'flex-end', marginBottom: spacing.lg },
  greetingSmall: { color: C.muted, fontSize: 12, marginBottom: 5 },
  greetingTitle: { color: C.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.4, marginBottom: 3 },
  greetingSubtitle: { color: C.muted, fontSize: 14 },
  homeFeatureRow: { flexDirection: 'row-reverse', gap: 9, marginBottom: spacing.md },
  homeFeatureCard: { flex: 1, minWidth: 0, minHeight: 119, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151019', borderRadius: 18, borderWidth: 1, borderColor: '#38283F', paddingHorizontal: 6, paddingVertical: 12, shadowColor: '#7135A6', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.14, shadowRadius: 17, elevation: 2 },
  homeFeatureIcon: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  homeFeatureTitle: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  homeFeatureValue: { color: C.muted, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4, lineHeight: 14 },
  homeFeatureNote: { color: C.muted, opacity: 0.8, fontSize: 9, fontWeight: '500', textAlign: 'center', marginTop: 2, lineHeight: 12 },
  homeTimePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  homeLtrTime: { writingDirection: 'ltr' },
  homeProgressCard: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: spacing.md, marginBottom: spacing.lg, shadowColor: '#000000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.16, shadowRadius: 15, elevation: 2 },
  homeProgressHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  homeProgressCopy: { alignItems: 'flex-end' },
  homeProgressTitle: { color: C.ink, fontSize: 13, fontWeight: '700' },
  homeProgressCaption: { color: C.muted, fontSize: 10, marginTop: 4 },
  homeProgressPercent: { color: C.violet, fontSize: 25, fontWeight: '800', letterSpacing: -0.4 },
  assistantCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: '#3B2948', padding: spacing.md, marginBottom: spacing.lg, shadowColor: '#000000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 2 },
  assistantIcon: { width: 42, height: 42, borderRadius: radius.control, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md, shadowColor: C.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 1 },
  assistantCopy: { flex: 1, alignItems: 'flex-end' },
  assistantTitleRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  assistantTitle: { color: C.ink, fontSize: 14, fontWeight: '700' },
  assistantBadge: { color: C.violet, fontSize: 9, fontWeight: '700', backgroundColor: C.purpleSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, marginRight: spacing.sm },
  assistantCaption: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: 'right', marginTop: 5 },
  dashboardCard: { backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, padding: spacing.md, marginBottom: spacing.lg, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 2 },
  dashboardCardHeading: { flexDirection: 'row-reverse', alignItems: 'center' },
  dashboardIcon: { width: 38, height: 38, borderRadius: radius.control, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md },
  dashboardCardCopy: { flex: 1, alignItems: 'flex-end' },
  dashboardCardTitle: { color: C.ink, fontSize: 14, fontWeight: '700' },
  dashboardCardCaption: { color: C.muted, fontSize: 11, marginTop: 4 },
  attendanceMetrics: { flexDirection: 'row-reverse', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, marginTop: spacing.md, paddingTop: spacing.md },
  attendanceMetric: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' },
  attendanceMetricValue: { color: C.ink, fontSize: 19, fontWeight: '700', marginHorizontal: 6 },
  attendanceMetricLabel: { color: C.muted, fontSize: 11 },
  metricDivider: { width: 1, height: 24, backgroundColor: C.line },
  progressCaptionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: 7 },
  progressCaption: { color: C.muted, fontSize: 10, fontWeight: '600' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  progressFill: { height: '100%', overflow: 'hidden', borderRadius: radius.pill },
  progressSegments: { flexDirection: 'row', width: '100%', height: '100%' },
  progressSegment: { flex: 1, height: '100%' },
  homeGuardCard: { paddingHorizontal: spacing.md, marginBottom: spacing.md, borderColor: '#30263B', borderRadius: 19 },
  pressedControl: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  heroCard: { backgroundColor: C.purpleDeep, borderRadius: radius.panel, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success, marginLeft: 7 },
  heroBadgeText: { color: C.ink, fontSize: 12, fontWeight: '600' },
  heroSparkle: { color: C.violet, fontSize: 24 },
  heroNumber: { color: C.ink, fontSize: 40, lineHeight: 46, fontWeight: '800', textAlign: 'right', marginTop: 13 },
  heroLabel: { color: 'rgba(245,243,247,0.74)', fontSize: 13, textAlign: 'right', marginTop: 1 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 16 },
  heroBottomRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  heroMetric: { minWidth: 92, alignItems: 'flex-end' },
  heroMetricNumber: { color: C.ink, fontSize: 21, fontWeight: '800' },
  heroMetricLabel: { color: 'rgba(245,243,247,0.74)', fontSize: 11, marginTop: 2 },
  heroMetricDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 17 },
  heroArrow: { marginRight: 'auto', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  heroArrowText: { color: C.ink, fontSize: 20 },
  statRow: { flexDirection: 'row-reverse', marginBottom: 22 },
  smallStatCard: { flex: 1, backgroundColor: C.card, borderRadius: 19, padding: 15, minHeight: 134, borderWidth: 1, borderColor: C.line },
  statIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statEmoji: { color: C.ink, fontSize: 17, fontWeight: '700' },
  statValue: { color: C.ink, fontSize: 24, fontWeight: '800', textAlign: 'right' },
  statLabel: { color: C.ink, fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  statFootnote: { color: C.muted, fontSize: 10, textAlign: 'right', marginTop: 6 },
  pageTitle: { alignItems: 'flex-end', marginTop: spacing.md, marginBottom: spacing.xl },
  eyebrow: { color: C.purple, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  pageHeading: { color: C.ink, fontSize: 31, fontWeight: '800' },
  pageCaption: { color: C.muted, fontSize: 13, marginTop: 5 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  linkText: { color: C.purple, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 3, borderWidth: 1, borderColor: C.line, marginBottom: spacing.xl, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 2 },
  miniShift: { minHeight: 68, flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 11 },
  withTopBorder: { borderTopWidth: 1, borderTopColor: C.line },
  miniShiftInfo: { flex: 1, alignItems: 'flex-end', marginRight: 11 },
  guardStatusGroup: { paddingVertical: 10 },
  guardStatusHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  guardStatusTitle: { color: C.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  guardStatusRow: { minHeight: 34, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line },
  guardStatusPlace: { color: C.muted, fontSize: 11, textAlign: 'right' },
  guardStatusName: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'left' },
  guardStatusEmpty: { color: C.muted, fontSize: 11, textAlign: 'right', paddingVertical: 5 },
  guardStatusDivider: { height: 1, backgroundColor: C.line, marginVertical: 4 },
  cardPrimary: { color: C.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  cardSecondary: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  chevron: { color: C.muted, fontSize: 26, marginLeft: 2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.ink, fontWeight: '800' },
  taskRow: { minHeight: 74, flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
  taskDone: { opacity: 0.63 },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  checkBoxDone: { backgroundColor: C.purple, borderColor: C.purple },
  checkMark: { color: C.ink, fontSize: 14, fontWeight: '800' },
  taskInfo: { flex: 1, alignItems: 'flex-end', marginRight: 11 },
  taskTitle: { color: C.ink, fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 7 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.muted },
  taskMeta: { flexDirection: 'row-reverse', alignItems: 'center' },
  dueText: { color: C.muted, fontSize: 10, marginRight: 7 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 5 },
  pillGreen: { backgroundColor: C.successSoft },
  pillOrange: { backgroundColor: C.orangeSoft },
  pillRed: { backgroundColor: C.redSoft },
  pillBlue: { backgroundColor: C.blueSoft },
  pillNeutral: { backgroundColor: C.surfaceAlt },
  pillText: { fontSize: 10, fontWeight: '700' },
  pillTextGreen: { color: C.success },
  pillTextOrange: { color: C.orange },
  pillTextRed: { color: C.red },
  pillTextBlue: { color: C.blue },
  pillTextNeutral: { color: C.muted },
  demoNote: { flexDirection: 'row-reverse', alignItems: 'flex-start', backgroundColor: C.surfaceAlt, borderRadius: radius.control, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  demoNoteIcon: { color: C.purple, fontSize: 13, marginLeft: 8, marginTop: 1 },
  demoNoteText: { flex: 1, color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  searchBox: { height: 48, backgroundColor: C.surface, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 13, marginBottom: 15 },
  searchIcon: { color: C.muted, fontSize: 23, marginLeft: 9 },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, paddingVertical: 0 },
  peopleZoomRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: -5, marginBottom: 12 },
  peopleZoomHint: { color: C.muted, fontSize: 10, textAlign: 'right' },
  peopleZoomControls: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: radius.control, padding: 3 },
  zoomButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderRadius: 9, borderWidth: 1, borderColor: C.line },
  zoomButtonText: { color: C.purple, fontSize: 17, fontWeight: '800', lineHeight: 21 },
  zoomValue: { minWidth: 43, color: C.ink, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  peopleControls: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  peopleActionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  peopleSection: { marginBottom: 18 },
  peopleSectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  peopleSectionEmpty: { color: C.muted, fontSize: 12, textAlign: 'right', paddingVertical: 10 },
  readinessHeaderText: { color: C.violetLight, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  storageBar: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  storageBarText: { color: C.muted, fontSize: 11, textAlign: 'center' },
  backupExplanation: { color: C.muted, fontSize: 13, lineHeight: 21, textAlign: 'right', marginBottom: 12 },
  peopleActionButton: { minHeight: 44, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  peopleActionText: { color: C.ink, fontSize: 12, textAlign: 'right' },
  peopleSelectionToolbar: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 10, marginBottom: 12, backgroundColor: C.purpleSoft, borderRadius: radius.card },
  peopleDeleteButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.control, backgroundColor: C.redSoft, alignItems: 'center', justifyContent: 'center' },
  peopleDeleteText: { color: C.red, fontSize: 12, fontWeight: '700' },
  peopleCardCheck: { alignSelf: 'flex-end', marginBottom: 8 },
  personSelected: { borderColor: C.violet, backgroundColor: C.purpleSoft },
  personSheetScroll: { flexShrink: 1 },
  personStatusInput: { minHeight: 76, paddingTop: 12, paddingBottom: 12 },
  personStatusDetail: { padding: 12, marginTop: 8, backgroundColor: C.surface, borderRadius: radius.control, borderWidth: 1, borderColor: C.line },
  personStatusValue: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  filterRow: { flexDirection: 'row-reverse' },
  peopleGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  personCard: { width: '31.7%', minHeight: 190, alignItems: 'center', backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 6, paddingVertical: 11, marginBottom: 9 },
  personCardLarge: { width: '97%', minHeight: 264 },
  personCardName: { width: '100%', color: C.ink, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  personCardRole: { maxWidth: '100%', color: C.muted, fontSize: 9, textAlign: 'center', marginTop: 3, marginBottom: 6 },
  peopleCompactGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 1 },
  personCompactCard: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 5, paddingVertical: 7, marginBottom: 9 },
  personCompactName: { width: '100%', color: C.ink, fontSize: 11, lineHeight: 15, fontWeight: '800', textAlign: 'center' },
  personCompactStatus: { maxWidth: '100%', fontSize: 9, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  personCompactStatusActive: { color: C.purple },
  personCompactStatusAway: { color: C.orange },
  personCompactLocation: { maxWidth: '100%', color: C.muted, fontSize: 8, textAlign: 'center', marginTop: 4 },
  statusTagRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', marginTop: 7 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoInitials: { color: C.violet, fontWeight: '800' },
  photoAddHint: { color: C.purple, fontSize: 10, fontWeight: '700', marginTop: 2 },
  personInfo: { flex: 1, alignItems: 'flex-end', marginRight: 11 },
  personStatus: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 5 },
  personStatusText: { color: C.muted, fontSize: 10 },
  bottomHint: { textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 9, marginBottom: 6 },
  rosterTopActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rosterTopHint: { color: C.muted, fontSize: 11, textAlign: 'right' },
  rosterSettingsButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.control, paddingHorizontal: 10, paddingVertical: 9 },
  rosterSettingsButtonText: { color: C.purple, fontSize: 10, fontWeight: '800' },
  rosterSettingsIcon: { color: C.purple, marginLeft: 6 },
  rosterBulkToolbar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.purpleSoft, borderRadius: radius.card, padding: 9, marginBottom: 11, borderWidth: 1, borderColor: C.line },
  rosterBulkActions: { flexDirection: 'row-reverse', alignItems: 'center' },
  rosterBulkButton: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  rosterBulkButtonText: { color: C.ink, fontSize: 10, fontWeight: '800' },
  rosterClearSelection: { paddingHorizontal: 8, paddingVertical: 7 },
  rosterClearSelectionText: { color: C.muted, fontSize: 10, fontWeight: '700' },
  rosterSelectedCount: { color: C.ink, fontSize: 11, fontWeight: '800' },
  rosterPersonCard: { backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, padding: 13, marginBottom: 10, shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 14, elevation: 2 },
  rosterPersonCardSelected: { borderColor: C.violet, backgroundColor: C.purpleSoft },
  rosterPersonTop: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  rosterCheckbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  rosterCheckboxSelected: { backgroundColor: C.purple, borderColor: C.purple },
  rosterCheckboxMark: { color: C.ink, fontSize: 14, fontWeight: '800' },
  rosterPersonInfo: { flex: 1, alignItems: 'flex-end' },
  rosterPersonName: { color: C.ink, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  rosterPersonRole: { color: C.muted, fontSize: 10, textAlign: 'right', marginTop: 3 },
  rosterFieldsRow: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  rosterField: { flex: 1, marginLeft: 8 },
  rosterFieldLabel: { color: C.muted, fontSize: 10, fontWeight: '700', textAlign: 'right', marginBottom: 5 },
  rosterValueButton: { minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.control, paddingHorizontal: 10 },
  rosterValueButtonActive: { backgroundColor: C.purpleSoft, borderColor: C.violet },
  rosterValueDisabled: { backgroundColor: C.surfaceAlt },
  rosterValueText: { color: C.ink, fontSize: 11, fontWeight: '700', textAlign: 'right', flex: 1 },
  rosterValueTextActive: { color: C.purple, fontWeight: '800' },
  rosterValueChevron: { color: C.purple, fontSize: 14, marginRight: 7 },
  rosterDisabledText: { color: C.muted, fontSize: 10, textAlign: 'right' },
  rosterReasonField: { marginTop: 10 },
  rosterPlaceholder: { color: C.muted },
  rosterChoiceList: { maxHeight: 420 },
  rosterChoiceOption: { minHeight: 50, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.card, paddingHorizontal: 13, marginBottom: 7 },
  rosterChoiceOptionSelected: { backgroundColor: C.purpleSoft, borderColor: C.violet },
  rosterChoiceOptionText: { color: C.ink, fontSize: 12, fontWeight: '600' },
  rosterChoiceOptionTextSelected: { color: C.purple, fontWeight: '800' },
  rosterChoiceRadio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  rosterChoiceRadioSelected: { borderColor: C.purple },
  rosterChoiceRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple },
  emptyCard: { backgroundColor: C.card, borderRadius: radius.card, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', padding: 15 },
  dateStrip: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.card, borderRadius: radius.card, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  dateStripDay: { color: C.purple, fontSize: 11, fontWeight: '700', marginLeft: 10 },
  dateStripDate: { color: C.ink, fontSize: 25, fontWeight: '800' },
  dateStripMonth: { color: C.muted, fontSize: 11, marginRight: 7 },
  dateStripSpacer: { flex: 1 },
  infoBanner: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.orangeSoft, borderRadius: radius.control, padding: 11, marginBottom: 15, borderWidth: 1, borderColor: C.line },
  infoBannerIcon: { color: C.orange, marginLeft: 8 },
  infoBannerText: { color: C.muted, fontSize: 11, flex: 1, textAlign: 'right' },
  guardMatrix: { flexDirection: 'row-reverse', backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginBottom: 12 },
  guardHoursColumn: { width: 78, backgroundColor: C.surfaceAlt, borderLeftWidth: 1, borderLeftColor: C.line },
  guardHoursHeader: { height: 58, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  guardMatrixHeaderText: { color: C.muted, fontSize: 11, fontWeight: '800' },
  guardHourCell: { height: 74, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  guardHourButton: { minWidth: 61, alignItems: 'center', paddingVertical: 4, borderRadius: 7 },
  guardHourText: { color: C.ink, fontSize: 11, fontWeight: '800' },
  guardHourDash: { color: C.muted, fontSize: 9, lineHeight: 10 },
  guardPostsScroll: { flex: 1 },
  guardPostsRow: { flexDirection: 'row-reverse', alignItems: 'stretch' },
  guardPostColumnView: { width: 104, borderLeftWidth: 1, borderLeftColor: C.line },
  guardPostHeader: { height: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: C.surfaceAlt, borderBottomWidth: 1, borderBottomColor: C.line },
  guardPostHeaderName: { maxWidth: '100%', color: C.purpleDeep, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  guardPostHeaderHint: { color: C.purple, fontSize: 9, fontWeight: '700', marginTop: 4 },
  guardAssignmentCell: { height: 74, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  guardAssignmentCellFilled: { backgroundColor: C.purpleSoft },
  guardAssignmentName: { color: C.ink, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  guardAssignmentEmpty: { color: C.purple, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  guardMatrixActions: { flexDirection: 'row-reverse', marginBottom: 12 },
  addGuardAction: { flex: 1, marginBottom: 0, marginLeft: 8 },
  shareGuardButton: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple, borderRadius: radius.control, marginTop: -4, marginBottom: 13, paddingHorizontal: 10, shadowColor: C.violet, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 2 },
  shareGuardIcon: { color: C.ink, marginLeft: 7 },
  shareGuardText: { color: C.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  guardTable: { backgroundColor: C.card, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginBottom: 13 },
  guardTableHeader: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.surfaceAlt, borderBottomWidth: 1, borderBottomColor: C.line },
  guardHeaderText: { color: C.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  guardPostColumn: { width: '28%' },
  guardTimeColumn: { width: '39%' },
  guardAssigneeColumn: { width: '33%' },
  guardTableRow: { minHeight: 74, flexDirection: 'row-reverse', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: C.line },
  guardCell: { justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: C.line },
  guardPostCell: { width: '28%', alignItems: 'flex-end', paddingHorizontal: 8 },
  guardPostName: { width: '100%', color: C.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  guardCellHint: { color: C.purple, fontSize: 9, fontWeight: '700', marginTop: 5 },
  guardTimeCell: { width: '39%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  timeButton: { minWidth: 46, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceAlt, borderRadius: 9, paddingHorizontal: 4, borderWidth: 1, borderColor: C.line },
  timeButtonText: { color: C.purpleDeep, fontSize: 11, fontWeight: '800' },
  timeRangeDash: { color: C.muted, fontSize: 10, marginHorizontal: 2 },
  guardAssigneeCell: { width: '33%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 5, borderLeftWidth: 0 },
  guardAssigneeText: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  guardAssigneeName: { maxWidth: '100%', color: C.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  guardAssigneeEmpty: { color: C.purple },
  guardAssigneeMeta: { maxWidth: '100%', color: C.muted, fontSize: 8, textAlign: 'right', marginTop: 3 },
  guardAssigneeChevron: { color: C.purple, fontSize: 18, marginRight: 3 },
  addGuardButton: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderRadius: radius.control, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  addGuardPlus: { color: C.purple, fontSize: 18, fontWeight: '800', marginLeft: 6 },
  addGuardText: { color: C.purple, fontSize: 12, fontWeight: '800' },
  timeline: { marginBottom: 10 },
  timelineRow: { flexDirection: 'row-reverse', minHeight: 118 },
  timelineTime: { width: 53, alignItems: 'flex-end', paddingTop: 12 },
  timeText: { color: C.ink, fontSize: 11, fontWeight: '700' },
  timeEnd: { color: C.muted, fontSize: 10, marginTop: 3 },
  timelineRail: { width: 25, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.line, marginTop: 16, zIndex: 1 },
  timelineDotActive: { backgroundColor: C.violet, borderWidth: 3, borderColor: C.purpleSoft, width: 14, height: 14, borderRadius: 7, marginTop: 14 },
  timelineLine: { width: 1, flex: 1, backgroundColor: C.line, marginTop: 2 },
  shiftCard: { flex: 1, backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 12 },
  shiftCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  editLabel: { color: C.purple, fontSize: 11, fontWeight: '700' },
  shiftPersonRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  taskSummary: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.purpleDeep, borderRadius: radius.panel, padding: 19, marginBottom: 23, borderWidth: 1, borderColor: '#4D2864' },
  taskSummaryNumber: { color: C.ink, fontSize: 30, fontWeight: '800', textAlign: 'right' },
  taskSummaryLabel: { color: 'rgba(245,243,247,0.74)', fontSize: 12, textAlign: 'right', marginTop: 2 },
  taskSummaryIcon: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  taskSummaryCheck: { color: C.ink, fontSize: 23, fontWeight: '700' },
  taskActionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.purple, borderRadius: radius.control, paddingHorizontal: 12, minHeight: 42, paddingVertical: 8, shadowColor: C.violet, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 2 },
  addButtonPlus: { color: C.ink, marginLeft: 7 },
  addButtonText: { color: C.ink, fontSize: 11, fontWeight: '700' },
  priorityHint: { backgroundColor: C.blueSoft, borderRadius: radius.card, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.line },
  priorityHintTitle: { color: C.blue, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 5 },
  priorityHintBody: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  tabBar: { flexDirection: 'row', flexShrink: 0, minHeight: 92, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#332B38', borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: '#100D13', paddingHorizontal: 10, paddingTop: 15, paddingBottom: 18, overflow: 'hidden' },
  tabButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'flex-start', position: 'relative', zIndex: 1 },
  tabIconWrap: { width: 35, height: 28, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { color: C.navigationMuted, fontSize: 11, marginTop: 5, textAlign: 'center' },
  tabLabelActive: { color: C.navigationPurple, fontWeight: '700' },
  navigationAddSlot: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'flex-start', position: 'relative', zIndex: 1 },
  navigationAddButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: C.navigationGradientBottom },
  navigationButtonBackground: { zIndex: 0 },
  navigationFoxIcon: { position: 'relative', zIndex: 1, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navigationAddPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  navigationAction: { minHeight: 58, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderRadius: radius.control, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  navigationActionText: { color: C.ink, fontSize: 16, textAlign: 'right' },
  navigationActionHint: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  domainMenuGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  domainMenuCard: { width: '48%', flexGrow: 1, minHeight: 86, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: '#38283F', borderRadius: radius.card, padding: 12 },
  domainMenuText: { color: C.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  domainPlaceholder: { alignItems: 'center', padding: 24, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: radius.panel },
  domainPlaceholderIcon: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: C.purpleSoft, marginBottom: 16 },
  domainPlaceholderTitle: { color: C.ink, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  domainPlaceholderText: { color: C.ink, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  domainPlaceholderHint: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: spacing.xl, paddingTop: 10, paddingBottom: 28, maxHeight: '90%', borderWidth: 1, borderColor: C.line },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 17 },
  modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  modalTitle: { color: C.ink, fontSize: 19, fontWeight: '800' },
  closeButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  closeButtonText: { color: C.muted, fontSize: 22, lineHeight: 25 },
  profileTop: { alignItems: 'center', paddingVertical: 9 },
  profileStatusTags: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 },
  profileName: { color: C.ink, fontSize: 22, fontWeight: '800', marginTop: 12 },
  profileRole: { color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 10 },
  profileDetails: { backgroundColor: C.surface, borderRadius: radius.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, marginTop: 18 },
  detailRow: { minHeight: 49, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { color: C.muted, fontSize: 12 },
  detailValue: { color: C.ink, fontSize: 13, fontWeight: '600' },
  sheetFootnote: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 13 },
  sheetIntro: { color: C.muted, fontSize: 11, textAlign: 'right', marginBottom: 14 },
  peoplePickerList: { maxHeight: 350 },
  rosterSettingsInput: { minHeight: 100, maxHeight: 138, paddingTop: 11, lineHeight: 20 },
  guardDetailsInput: { minHeight: 112, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.control, paddingHorizontal: 13, paddingVertical: 12, color: C.ink, marginBottom: 13, textAlignVertical: 'top' },
  futureFields: { backgroundColor: C.surfaceAlt, borderRadius: radius.control, padding: 12, marginTop: 2, borderWidth: 1, borderColor: C.line },
  futureFieldsTitle: { color: C.ink, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  futureFieldsText: { color: C.muted, fontSize: 10, textAlign: 'right', marginTop: 5 },
  clearAssigneeButton: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 3 },
  clearAssigneeText: { color: C.red, fontSize: 11, fontWeight: '700' },
  timeWheelWrap: { height: 206, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: C.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  wheelColumn: { width: 88, alignItems: 'center' },
  wheelLabel: { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 7 },
  wheelScroll: { width: 82, height: 168 },
  wheelContent: { alignItems: 'center', paddingVertical: 63 },
  wheelItem: { width: 82, height: 42, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { color: C.muted, fontSize: 17, fontWeight: '600' },
  wheelItemTextActive: { color: C.purpleDeep, fontSize: 22, fontWeight: '800' },
  wheelColon: { color: C.ink, fontSize: 24, fontWeight: '800', marginTop: 22, marginHorizontal: 2 },
  wheelSelection: { position: 'absolute', left: 23, right: 23, top: 85, height: 42, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.violet, borderRadius: 8 },
  selectedTimePreview: { color: C.ink, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  photoEditorRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  photoEditorText: { flex: 1, alignItems: 'flex-end', marginRight: 14 },
  photoPickerButton: { backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: C.line, borderRadius: radius.control, paddingHorizontal: 13, paddingVertical: 9, marginTop: 3 },
  photoPickerText: { color: C.purple, fontSize: 11, fontWeight: '800' },
  formHint: { color: C.muted, fontSize: 10, textAlign: 'right', marginTop: -9, marginBottom: 12 },
  formLabel: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 7, marginTop: 4 },
  formInput: { minHeight: 48, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.control, paddingHorizontal: 13, color: C.ink, marginBottom: 14 },
  personChoice: { flexDirection: 'row-reverse', alignItems: 'center', padding: 8, borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent', marginBottom: 4 },
  personChoiceActive: { borderColor: C.violet, backgroundColor: C.purpleSoft },
  choiceName: { color: C.ink, fontSize: 12, fontWeight: '700', marginRight: 9 },
  choiceRole: { color: C.muted, fontSize: 11, marginRight: 'auto' },
  choiceCheck: { color: C.purple, fontSize: 15, fontWeight: '800', marginLeft: 5 },
  primaryButton: { minHeight: 50, backgroundColor: C.purple, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', marginTop: 15, shadowColor: C.violet, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 2 },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: C.ink, fontSize: 13, fontWeight: '800' },
  choiceGroup: { marginBottom: 11 },
  choiceGroupRow: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  choicePill: { borderRadius: radius.control, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 13, paddingVertical: 10, marginLeft: 7, marginBottom: 6 },
  choicePillActive: { backgroundColor: C.purpleSoft, borderColor: C.violet },
  choicePillText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  choicePillTextActive: { color: C.purple, fontWeight: '800' },
});
