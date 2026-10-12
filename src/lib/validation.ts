/**
 * Client-side validation that mirrors the API rules exactly,
 * so people see a friendly message before a round-trip.
 */

const NAME_RE = /^[A-Za-zÀ-ÿ'’.\- ]+$/;

export const validators = {
  firstName: (v: string) => name(v, 'First name'),
  lastName: (v: string) => name(v, 'Last name'),
  gmail: gmail,
  password: password,
  confirmPassword: (v: string, passwordValue: string) => confirmPassword(passwordValue, v),
  bio: bio,
  location: location,
  phone: phone,
  birthday: birthday,
  gender: gender,
  avatar: avatar,
};

function name(v: string, field: string): string | null {
  const value = v.trim();
  if (!value) return `${field} is needed — mind filling it in?`;
  if (/\d/.test(value)) return `${field} can't contain numbers. Letters only, please 🙂`;
  if (!NAME_RE.test(value)) return `${field} can only have letters, spaces, hyphens or periods.`;
  if (value.length < 2) return `${field} looks a little short — at least 2 characters.`;
  if (value.length > 50) return `${field} is a bit long — please keep it under 50 characters.`;
  return null;
}

function gmail(v: string): string | null {
  const value = v.trim().toLowerCase();
  if (!value) return "We'll need your Gmail to verify you — please add it.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "That email doesn't look right yet — try something like juan@gmail.com.";
  }
  if (!value.endsWith('@gmail.com')) {
    return 'Please use a Gmail address (it must end with @gmail.com).';
  }
  return null;
}

function password(v: string): string | null {
  if (!v) return 'Please create a password.';
  if (v.length < 8) return 'Password needs at least 8 characters — you can do it 💪';
  if (v.length > 72) return 'That password is too long — please keep it under 72 characters.';
  if (!/[A-Za-z]/.test(v)) return 'Add at least one letter to your password.';
  if (!/\d/.test(v)) return 'Add at least one number to your password.';
  return null;
}

function confirmPassword(passwordValue: string, confirmValue: string): string | null {
  if (!confirmValue) return 'Please re-type your password to confirm it.';
  if (passwordValue !== confirmValue) return "Passwords don't match yet — give it another look.";
  return null;
}

function bio(v: string): string | null {
  const value = v.trim();
  if (!value) return 'Tell us a little about you — a short bio goes a long way.';
  if (value.length > 255) {
    return `Bio is limited to 255 characters — you are ${value.length - 255} over. Trim it a little?`;
  }
  return null;
}

function location(v: string): string | null {
  if (!v.trim()) return 'Please pick your barangay so we know where you play from.';
  return null;
}

function phone(v: string): string | null {
  const value = v.trim().replace(/[\s-]/g, '');
  if (!value) return "We'd love your number for booking reminders.";
  if (!/^\d+$/.test(value)) return 'Phone number can only contain numbers — no letters or symbols.';
  if (!value.startsWith('09')) return 'Philippine mobile numbers start with 09 — try again 🙂';
  if (value.length > 11) return `Phone number is too long (${value.length}/11). It should be exactly 11 digits.`;
  if (value.length < 11) return `Phone number is a bit short (${value.length}/11) — it needs 11 digits.`;
  return null;
}

function birthday(v: string): string | null {
  if (!v) return 'Please pick your birthday.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'That date does not look right — please pick it again.';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'That date does not look right — please pick it again.';
  const now = new Date();
  if (d > now) return 'That birthday is in the future — pick a date before today 🙂';
  const age = Math.floor((now.getTime() - d.getTime()) / (365.25 * 864e5));
  if (age < 5) return 'Please double-check that birthday — the age looks too young.';
  if (age > 120) return 'Please double-check that birthday — the age looks too high.';
  return null;
}

function gender(v: string): string | null {
  if (!v) return 'Please choose one from the dropdown.';
  if (!['Male', 'Female', 'Non-binary', 'Prefer not to say'].includes(v)) {
    return 'Please choose one from the dropdown.';
  }
  return null;
}

/** null means "use my initials" — allowed, but the field must be answered. */
function avatar(v: string | null | undefined): string | null {
  if (v === undefined) {
    return 'Pick a profile picture (or use your initials) so teammates can spot you.';
  }
  return null;
}

/** Drop the first error so callers can show a single friendly banner. */
export function firstError(errors: Record<string, string | null>): string | null {
  for (const value of Object.values(errors)) if (value) return value;
  return null;
}
