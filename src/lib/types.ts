export type Role = 'client' | 'owner';

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  bio: string;
  location: string;
  phone: string;
  birthday: string;
  gender: string;
  avatar: string | null;
  emailVerified: boolean;
  profileComplete: boolean;
  createdAt: string;
};

export type Court = {
  id: string;
  number: number;
  name: string;
  venue: string;
};

export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

/** Where a booking stands against the reference the client handed over. */
export type PaymentStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type PaymentMethod = 'gcash' | 'bank';

export type Payment = {
  method: '' | PaymentMethod;
  reference: string;
  amount: number;
  status: PaymentStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
};

export type Booking = {
  id: string;
  userId: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  durationMin: number;
  status: BookingStatus;
  note: string;
  /** Display name of whoever created the booking (server resolves it). */
  createdBy: string | null;
  createdAt: string;
  /** Always present; `status: 'none'` means no payment went through the app. */
  payment: Payment;
  user?: User | null;
  court?: Court | null;
  startsAt?: string;
};

/** One hand-out of points from the admin's ledger. */
export type PointEntry = {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  createdAt: string;
  user?: User | null;
};

export type SlotState = {
  time: string;
  status: 'available' | 'booked' | 'past';
  mine?: boolean;
  bookedBy?: string | null;
  blockedNow?: boolean;
};

export type CourtSlots = {
  court: Court;
  slots: SlotState[];
};

export type Tournament = {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  division: string;
  format: string;
  slots: number;
  fee: number;
  prize: string;
  description: string;
  status: 'open' | 'ongoing' | 'finished';
  announced: boolean;
  participants: string[];
  joinedCount?: number;
  isFull?: boolean;
  registered?: string[];
  createdBy: string;
  createdAt: string;
};

/** A player, as a bracket row or standings row shows them. */
export type TournamentPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  location: string;
};

/** One fixture. Scores stay null until the owner reports the result. */
export type TournamentMatch = {
  id: string;
  tournamentId: string;
  round: string;
  matchNo: number;
  home: TournamentPlayer | null;
  away: TournamentPlayer | null;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'finished';
  playedAt: string | null;
};

/** One row of a tournament's standings, computed from finished matches. */
export type StandingRow = {
  tournamentId: string;
  /** 1 = champion. Ties share a rank, exactly as Postgres `rank()` does. */
  position: number;
  player: TournamentPlayer;
  played: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

/* ------------------------------------------------------------------ */
/* DOUBLES TOURNAMENTS (Phase 3)                                       */
/* ------------------------------------------------------------------ */

/** Two players entered together. Doubles only — singles stays as it was. */
export type TournamentTeam = {
  id: string;
  tournamentId: string;
  seed: number | null;
  player1: TournamentPlayer | null;
  player2: TournamentPlayer | null;
};

export type TeamMatchStatus = 'pending' | 'confirmed' | 'disputed';

/** One fixture in a generated bracket. A null team is a slot not filled yet. */
export type TeamMatch = {
  id: string;
  tournamentId: string;
  roundNo: number;
  roundLabel: string;
  matchNo: number;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
  winner: TournamentTeam | null;
  courtId: string | null;
  scheduledTime: string | null;
  team1Score: number | null;
  team2Score: number | null;
  resultStatus: TeamMatchStatus;
  /** Set when the winner of this match has somewhere to go. */
  nextMatchId: string | null;
  nextSlot: 'team1' | 'team2' | null;
};

/** One column of the bracket, ready to render left-to-right. */
export type BracketRound = {
  label: string;
  matches: TeamMatch[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  tournamentId?: string;
  createdBy: string;
  createdAt: string;
};

export type RankingRow = {
  user: User;
  points: number;
  matches: number;
  wins: number;
  tournaments: number;
};

export type AdminStats = {
  totalSignups: number;
  totalClients: number;
  verifiedClients: number;
  bookingsToday: number;
  bookingsTotal: number;
  tournaments: number;
  newThisWeek: number;
};
