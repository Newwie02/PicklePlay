/**
 * Field-level validation messages, keyed by form field.
 *
 * Kept in one place because the screens share the same shape — the
 * Supabase-backed data layer lives in `./db`.
 */
export type FieldErrors = Record<string, string>;
