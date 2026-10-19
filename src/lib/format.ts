/** Small formatting helpers shared across screens. */

export const VENUE = 'Spin & Smash Pickle Pavillion, Tagum City';

/**
 * Doubles tournaments are flagged by a distinct `format` value rather than a
 * new column, so every row created before this feature keeps working as-is.
 */
export const DOUBLES_FORMAT = 'single_elimination_doubles';

export function isDoubles(format?: string | null): boolean {
  return format === DOUBLES_FORMAT;
}

/** The option shown in the create form's format dropdown. */
export const DOUBLES_PICK = 'Doubles · Single Elimination';

/** Dropdown label -> the value stored in `tournaments.format`. */
export function toDbFormat(pick: string): string {
  return pick === DOUBLES_PICK ? DOUBLES_FORMAT : pick;
}

/** "single_elimination_doubles" -> "Doubles · Single Elimination" */
export function formatLabel(format?: string | null): string {
  if (isDoubles(format)) return DOUBLES_PICK;
  return format || 'Single Elimination';
}

/** "Ana" "Cruz" -> "Ana Cruz"; falls back when the profile is blank. */
export function playerName(first?: string | null, last?: string | null, fallback = 'TBD'): string {
  const name = `${first ?? ''} ${last ?? ''}`.trim();
  return name || fallback;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-11" -> "Sat, Oct 11, 2026" */
export function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "2026-10-11" -> "Oct 11" (compact, for list rows) */
export function formatShortDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "18:00" -> "6:00 PM" */
export function formatTime(time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hour = Number(m[1]);
  const minute = m[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${suffix}`;
}

/** Today / Tomorrow / the weekday, for quick scanning. */
export function relativeDay(date: string): string | null {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d.getTime() - today.getTime()) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return null;
}

/** The date/time line shown on the Next Game card. */
export function nextGameLine(date: string, time: string): string {
  const rel = relativeDay(date);
  const day = rel ?? formatDate(date);
  return `${day} · ${formatTime(time)}`;
}

/** Local today as YYYY-MM-DD (toISOString is UTC and can drift a day). */
export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** "JD" from "Juan Dela Cruz" */
export function initials(firstName: string, lastName: string): string {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "2 minutes ago" / "just now" — used for announcements. */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso.slice(0, 10));
}
