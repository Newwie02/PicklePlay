/** The 23 barangays of Tagum City, Davao del Norte. */
export const BARANGAYS: string[] = [
  'Apokon',
  'Bincungan',
  'Busaon',
  'Canocotan',
  'Cuambogan',
  'La Filipina',
  'Liboganon',
  'Madaum',
  'Magdum',
  'Magugpo East',
  'Magugpo North',
  'Magugpo Poblacion',
  'Magugpo South',
  'Magugpo West',
  'Mankilam',
  'New Balamban',
  'Nueva Fuerza',
  'Pagsabangan',
  'Pandapan',
  'San Agustin',
  'San Isidro',
  'San Miguel',
  'Visayan Village',
];

export const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export const VENUE_NAME = 'Spin & Smash Pickle Pavillion, Tagum City';

/**
 * Hourly start times, 6:00 AM to 9:00 PM.
 *
 * Mirrors `public.slot_times()` in `supabase/schema.sql` so the tournament
 * form can never offer a time the booking rules would reject.
 */
export const SLOT_TIMES: string[] = Array.from({ length: 16 }, (_, i) => {
  const hour = 6 + i;
  return `${String(hour).padStart(2, '0')}:00`;
});
