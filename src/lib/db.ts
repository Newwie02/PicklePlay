import { supabase } from './supabase';
import type {
  Announcement,
  Booking,
  BookingStatus,
  Court,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PointEntry,
  RankingRow,
  Tournament,
  User,
} from './types';

/**
 * Every read/write the app makes, expressed as Supabase queries + RPCs.
 * Business rules (no double-booking, no booking a slot that already
 * started, owner-only actions) live in Postgres SECURITY DEFINER
 * functions, so the client can't bypass them.
 */

/** Postgres returns snake_case; the screens speak camelCase. */
type Row = Record<string, any>;

export class DbError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}

/** Turn a Supabase error into the friendly message the UI expects. */
function fail(e: any): never {
  const msg: string = e?.message ?? '';
  // Our RPCs raise human sentences; Postgres prefixes them with "function ...".
  const cleaned = msg
    .replace(/^.*?returned:\s*/i, '')
    .replace(/postgrest rpc/i, '')
    .replace(/^\(|\)$/g, '')
    .trim();
  throw new DbError(cleaned || 'Something went wrong. Please try again.');
}

function mapUser(r: Row): User {
  return {
    id: r.id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    email: r.email ?? '',
    role: (r.role === 'owner' ? 'owner' : 'client') as User['role'],
    bio: r.bio ?? '',
    location: r.location ?? '',
    phone: r.phone ?? '',
    birthday: r.birthday ?? '',
    gender: r.gender ?? '',
    avatar: r.avatar ?? null,
    emailVerified: !!r.email_verified,
    profileComplete: !!r.profile_complete,
    createdAt: r.created_at ?? '',
  };
}

function mapCourt(r: Row): Court {
  return { id: r.id, number: r.number, name: r.name, venue: r.venue };
}

/** "2026-10-11" + "18:00" in the device's local zone. */
function startsAt(date: string, time: string): number {
  const t = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function mapPayment(r: Row): Payment {
  const m = r.payment_method;
  return {
    method: m === 'gcash' || m === 'bank' ? (m as PaymentMethod) : '',
    reference: r.payment_reference ?? '',
    amount: Number(r.payment_amount ?? 0),
    status: (r.payment_status ?? 'none') as PaymentStatus,
    verifiedBy: r.payment_verified_by ?? null,
    verifiedAt: r.payment_verified_at ?? null,
  };
}

function mapBooking(r: Row): Booking {
  const court = r.court ? (typeof r.court === 'string' ? JSON.parse(r.court) : r.court) : null;
  return {
    id: r.id,
    userId: r.user_id,
    courtId: r.court_id,
    date: r.date,
    time: r.time,
    durationMin: r.duration_min ?? 60,
    status: r.status as BookingStatus,
    note: r.note ?? '',
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? '',
    payment: mapPayment(r),
    user: r.profiles ? mapUser(r.profiles) : null,
    court: court ? mapCourt(court) : null,
    startsAt: startsAt(r.date, r.time).toString(),
  };
}

function mapTournament(r: Row): Tournament {
  return {
    id: r.id,
    name: r.name,
    venue: r.venue,
    date: r.date,
    time: r.time,
    division: r.division,
    format: r.format,
    slots: r.slots,
    fee: Number(r.fee ?? 0),
    prize: r.prize ?? '',
    description: r.description ?? '',
    status: r.status as Tournament['status'],
    announced: !!r.announced,
    participants: Array.isArray(r.registered) ? r.registered : [],
    joinedCount: Number(r.joined_count ?? 0),
    isFull: Number(r.joined_count ?? 0) >= Number(r.slots ?? 0),
    registered: Array.isArray(r.registered) ? r.registered : [],
    createdBy: r.created_by ?? '',
    createdAt: r.created_at ?? '',
  };
}

/* ------------------------------------------------------------------ */
/* PROFILE                                                             */
/* ------------------------------------------------------------------ */

export async function fetchProfile(uid: string): Promise<User> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) fail(error);
  return mapUser(data);
}

/**
 * Undoes the account GoTrue mints the moment somebody finishes Google's
 * consent screen without ever having signed up here. Left behind, that
 * half-made user would block the proper sign-up for the same Gmail
 * afterwards ("User already registered").
 *
 * Safe to call blindly: the SQL refuses anyone whose profile is complete,
 * who is the owner, or who has bookings or tournament entries.
 */
export async function discardIncompleteGoogleSignup(): Promise<void> {
  const { error } = await supabase.rpc('discard_incomplete_oauth_signup');
  if (error) fail(error);
}

export type ProfilePatch = Partial<{
  avatar: string | null;
  bio: string;
  location: string;
  phone: string;
  birthday: string;
  gender: string;
  profileComplete: boolean;
}>;

export async function updateProfile(uid: string, patch: ProfilePatch): Promise<User> {
  const body: Row = {};
  if ('avatar' in patch) body.avatar = patch.avatar ?? null;
  if ('bio' in patch) body.bio = patch.bio ?? '';
  if ('location' in patch) body.location = patch.location ?? '';
  if ('phone' in patch) body.phone = patch.phone ?? '';
  if ('birthday' in patch) body.birthday = patch.birthday ?? '';
  if ('gender' in patch) body.gender = patch.gender ?? '';
  if ('profileComplete' in patch) body.profile_complete = patch.profileComplete;

  const { data, error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', uid)
    .select('*')
    .single();
  if (error) fail(error);
  return mapUser(data);
}

/* ------------------------------------------------------------------ */
/* COURTS + SLOTS                                                      */
/* ------------------------------------------------------------------ */

export type SlotState = {
  time: string;
  status: 'available' | 'booked' | 'past';
  mine?: boolean;
  bookedBy?: string | null;
  blockedNow?: boolean;
};

export async function fetchCourts(): Promise<Court[]> {
  const { data, error } = await supabase.from('courts').select('*').order('number');
  if (error) fail(error);
  return (data ?? []).map(mapCourt);
}

export async function fetchCourtSlots(courtId: string, date: string): Promise<SlotState[]> {
  const { data, error } = await supabase.rpc('court_slots', {
    p_court_id: courtId,
    p_date: date,
  });
  if (error) fail(error);
  return (data ?? []).map((r: Row) => ({
    time: r.time,
    status: r.status as SlotState['status'],
    mine: !!r.mine,
    bookedBy: r.booked_by,
    blockedNow: !!r.blocked_now,
  }));
}

/**
 * Every court's grid for one day — the shape the Courts tab renders.
 * Four small RPCs in parallel rather than one giant query, so switching
 * dates stays snappy.
 */
export async function fetchSlotsForDay(
  date: string
): Promise<{ date: string; slots: { court: Court; slots: SlotState[] }[] }> {
  const courts = await fetchCourts();
  const slots = await Promise.all(
    courts.map(async (court) => ({
      court,
      slots: await fetchCourtSlots(court.id, date).catch(() => [] as SlotState[]),
    }))
  );
  return { date, slots };
}

/* ------------------------------------------------------------------ */
/* BOOKINGS                                                            */
/* ------------------------------------------------------------------ */

const BOOKING_SELECT = `
  *,
  profiles:user_id (*),
  court:court_id (id, number, name, venue)
`;

export async function fetchMyBookings(uid: string): Promise<{ bookings: Booking[]; next: Booking | null }> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('user_id', uid)
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) fail(error);

  const bookings = (data ?? []).map(mapBooking);
  const now = Date.now();
  return { bookings, next: bookings.find((b) => Number(b.startsAt) > now) ?? null };
}

/**
 * Book a slot. Passing `payment` is what puts the booking into 'pending':
 * the slot is held, and the reference only counts once the owner has
 * checked it against their GCash/bank history.
 */
export async function createBooking(input: {
  courtId: string;
  date: string;
  time: string;
  note?: string;
  payment?: { method: PaymentMethod; reference: string };
}): Promise<Booking> {
  const { data, error } = await supabase.rpc('create_booking', {
    p_court_id: input.courtId,
    p_date: input.date,
    p_time: input.time,
    p_note: input.note ?? '',
    p_pay_method: input.payment?.method ?? null,
    p_pay_reference: input.payment?.reference ?? null,
  });
  if (error) fail(error);
  return mapBooking(data);
}

export async function cancelBooking(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id });
  if (error) fail(error);
}

/* ------------------------------------------------------------------ */
/* OWNER: bookings over everyone                                       */
/* ------------------------------------------------------------------ */

export type AdminBooking = Booking & { user: User | null };

export async function adminFetchBookings(status: string = 'all'): Promise<AdminBooking[]> {
  let q = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) fail(error);
  return (data ?? []).map((r) => ({ ...mapBooking(r), user: r.profiles ? mapUser(r.profiles) : null }));
}

export async function adminFetchUsers(query = ''): Promise<{ users: User[]; total: number }> {
  let q = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .order('created_at', { ascending: false });
  const term = query.trim();
  if (term) {
    q = q.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,location.ilike.%${term}%`
    );
  }
  const { data, error } = await q;
  if (error) fail(error);

  // The filtered query's count isn't the headline number the Users screen
  // shows, so the true total of clients is fetched separately below.
  const { count: total } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'client');

  return { users: (data ?? []).map(mapUser), total: total ?? 0 };
}

export type AdminStats = {
  totalSignups: number;
  totalClients: number;
  verifiedClients: number;
  bookingsToday: number;
  bookingsTotal: number;
  tournaments: number;
  newThisWeek: number;
};

export async function adminFetchStats(): Promise<AdminStats> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [profiles, bookings, tournaments] = await Promise.all([
    supabase.from('profiles').select('role, email_verified, created_at'),
    supabase.from('bookings').select('date, status'),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }),
  ]);
  if (profiles.error) fail(profiles.error);
  if (bookings.error) fail(bookings.error);
  if (tournaments.error) fail(tournaments.error);

  const users = profiles.data ?? [];
  const clients = users.filter((u: Row) => u.role === 'client');
  const bks = bookings.data ?? [];

  return {
    totalSignups: users.length,
    totalClients: clients.length,
    verifiedClients: clients.filter((u: Row) => u.email_verified).length,
    bookingsToday: bks.filter((b: Row) => b.date === today && b.status !== 'cancelled').length,
    bookingsTotal: bks.filter((b: Row) => b.status !== 'cancelled').length,
    tournaments: tournaments.count ?? 0,
    newThisWeek: users.filter((u: Row) => (u.created_at ?? '') >= weekAgo).length,
  };
}

export async function adminCreateBooking(input: {
  userId: string;
  courtId: string;
  date: string;
  time: string;
  note?: string;
}): Promise<Booking> {
  const { data, error } = await supabase.rpc('admin_create_booking', {
    p_user_id: input.userId,
    p_court_id: input.courtId,
    p_date: input.date,
    p_time: input.time,
    p_note: input.note ?? '',
  });
  if (error) fail(error);
  return mapBooking(data);
}

export async function adminSetBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.rpc('set_booking_status', {
    p_booking_id: id,
    p_status: status,
  });
  if (error) fail(error);
}

/**
 * The owner matches a submitted reference against their GCash/bank history.
 * 'approved' confirms the booking; 'rejected' cancels it and gives the slot
 * back, so a reference that doesn't check out can't hold a court hostage.
 */
export async function adminReviewPayment(
  id: string,
  decision: 'approved' | 'rejected',
  reason = ''
): Promise<Booking> {
  const { data, error } = await supabase.rpc('review_payment', {
    p_booking_id: id,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) fail(error);
  return mapBooking(data);
}

/* ------------------------------------------------------------------ */
/* OWNER: points                                                       */
/* ------------------------------------------------------------------ */

/** Records an award in the ledger and returns the player's new total. */
export async function awardPoints(
  userId: string,
  points: number,
  reason = ''
): Promise<number> {
  const { data, error } = await supabase.rpc('award_points', {
    p_user_id: userId,
    p_points: points,
    p_reason: reason,
  });
  if (error) fail(error);
  return Number(data ?? 0);
}

/**
 * userId -> current points, straight off the rankings view the ladder
 * reads, so the admin screen and the public ranking can never disagree.
 */
export async function adminFetchPointTotals(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('rankings').select('id, points');
  if (error) fail(error);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.id] = Number(r.points ?? 0);
  return out;
}

/** Recent hand-outs, newest first — the audit trail behind the totals. */
export async function adminFetchLedger(limit = 30): Promise<PointEntry[]> {
  const { data, error } = await supabase
    .from('point_ledger')
    .select('*, profiles:user_id (*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    userId: r.user_id,
    delta: Number(r.delta ?? 0),
    reason: r.reason ?? '',
    createdAt: r.created_at ?? '',
    user: r.profiles ? mapUser(r.profiles) : null,
  }));
}

/* ------------------------------------------------------------------ */
/* TOURNAMENTS + ANNOUNCEMENTS                                         */
/* ------------------------------------------------------------------ */

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments_with_counts')
    .select('*')
    .order('date', { ascending: true });
  if (error) fail(error);
  return (data ?? []).map(mapTournament);
}

export type NewTournament = {
  name: string;
  date: string;
  time: string;
  division: string;
  format: string;
  slots: number;
  fee: number;
  prize: string;
  description: string;
  announce: boolean;
};

export async function createTournament(input: NewTournament): Promise<Tournament> {
  const { data, error } = await supabase.rpc('create_tournament', {
    p_name: input.name,
    p_date: input.date,
    p_time: input.time,
    p_division: input.division,
    p_format: input.format,
    p_slots: input.slots,
    p_fee: input.fee,
    p_prize: input.prize,
    p_description: input.description,
    p_announce: input.announce,
  });
  if (error) fail(error);
  return mapTournament(data);
}

export async function joinTournament(id: string): Promise<void> {
  const { error } = await supabase.rpc('join_tournament', { p_tournament_id: id });
  if (error) fail(error);
}

export async function leaveTournament(id: string): Promise<void> {
  const { error } = await supabase.rpc('leave_tournament', { p_tournament_id: id });
  if (error) fail(error);
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) fail(error);
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    title: r.title,
    body: r.body ?? '',
    pinned: !!r.pinned,
    tournamentId: r.tournament_id ?? undefined,
    createdBy: r.created_by ?? '',
    createdAt: r.created_at ?? '',
  }));
}

export async function createAnnouncement(title: string, body: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const { error } = await supabase
    .from('announcements')
    .insert({ title: title.trim(), body: body.trim(), pinned: true, created_by: uid });
  if (error) fail(error);
}

/* ------------------------------------------------------------------ */
/* RANKING                                                             */
/* ------------------------------------------------------------------ */

export async function fetchRankings(): Promise<{ rankings: RankingRow[]; myRank: number | null }> {
  const { data, error } = await supabase
    .from('rankings')
    .select('*')
    .order('points', { ascending: false })
    .order('wins', { ascending: false });
  if (error) fail(error);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;

  const rankings: RankingRow[] = (data ?? []).map((r: Row) => ({
    user: mapUser(r),
    points: Number(r.points ?? 0),
    matches: Number(r.matches ?? 0),
    wins: Number(r.wins ?? 0),
    tournaments: Number(r.tournaments ?? 0),
  }));

  const idx = rankings.findIndex((r) => r.user.id === uid);
  return { rankings, myRank: idx >= 0 ? idx + 1 : null };
}
