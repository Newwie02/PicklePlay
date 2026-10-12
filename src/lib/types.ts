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
