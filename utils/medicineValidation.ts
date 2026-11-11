// Shared validation rules for the Add Medicine form and the Edit modal.
// Each validator returns an error message, or '' when the value is valid.

export const MAX_QUANTITY = 10000;
export const NAME_MIN = 2;
export const NAME_MAX = 60;

// Letters in Latin (incl. accents) and Indic / other scripts, so names like
// "Crocin", "Paracétamol" or "पैरासिटामोल" are accepted.
const LETTER = /[A-Za-zÀ-ɏͰ-῿Ⰰ-퟿]/;
// Everything allowed in a name: letters, digits, spaces and - . , ( ) / + & ' %
const ALLOWED = /^[A-Za-z0-9À-ɏͰ-῿Ⰰ-퟿\s\-.,()/+&'%]+$/;

/** Trim and collapse internal whitespace: "  Vitamin   D3 " → "Vitamin D3". */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Clean a quantity as it's typed: drop signs, letters and spaces, but keep "."
 * so "2.5" shows a "whole numbers only" error instead of silently becoming "25".
 */
export function digitsOnly(text: string): string {
  return text.replace(/[^0-9.]/g, '');
}

export function validateName(raw: string): string {
  const name = normalizeName(raw);
  if (!name) return 'Enter the medicine name';
  if (name.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters`;
  if (name.length > NAME_MAX) return `Name is too long (max ${NAME_MAX} characters)`;
  if (!LETTER.test(name)) return 'Name must include letters, not just numbers or symbols';
  if (!ALLOWED.test(name)) return "Only letters, numbers, spaces and - . , ( ) / + & ' % are allowed";
  return '';
}

export interface ExistingMedicine {
  id: string;
  name: string;
  dosage: string;
}

const key = (s: string) => normalizeName(s).toLowerCase();

/**
 * Same name AND same dosage as a medicine already in the list → blocking error.
 * Same name, different dosage (e.g. Paracetamol 500mg vs 650mg) → warning only.
 */
export function checkDuplicate(
  name: string,
  dosage: string,
  existing: ExistingMedicine[],
  ignoreId?: string
): { error: string; warning: string } {
  const n = key(name);
  if (!n) return { error: '', warning: '' };
  const sameName = existing.filter(m => m.id !== ignoreId && key(m.name) === n);
  if (sameName.length === 0) return { error: '', warning: '' };
  const d = key(dosage).replace(/\s/g, '');
  const exact = d && sameName.find(m => key(m.dosage).replace(/\s/g, '') === d);
  if (exact) {
    return { error: `${exact.name} ${exact.dosage} is already in your list`, warning: '' };
  }
  const doses = sameName.map(m => m.dosage).join(', ');
  return { error: '', warning: `You already have ${sameName[0].name} (${doses}). Make sure this is a different strength.` };
}

// ── Expiry ────────────────────────────────────────────────────────────────────
// Rule used everywhere in the app: the expiry date is the LAST day the medicine
// can be used. It counts as expired from the following day.

export const MAX_EXPIRY_YEARS = 10;

function localMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Whole calendar days from today to the expiry date (0 = expires today, <0 = expired). */
export function daysUntilExpiry(expiry: string | Date, now: Date = new Date()): number {
  const e = localMidnight(new Date(expiry));
  const t = localMidnight(now);
  return Math.round((e.getTime() - t.getTime()) / 86400000);
}

export const isExpired = (expiry: string | Date, now?: Date) => daysUntilExpiry(expiry, now) < 0;

/** Parse "YYYY-MM-DD" as a LOCAL date (new Date("2027-05-01") would be UTC). */
export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((s || '').trim());
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : localMidnight(d);
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Latest expiry accepted — anything further out is almost certainly a typo in the year. */
export function maxExpiryDate(now: Date = new Date()): Date {
  const d = localMidnight(now);
  d.setFullYear(d.getFullYear() + MAX_EXPIRY_YEARS);
  return d;
}

export function validateExpiry(
  expiry: Date | null,
  now: Date = new Date()
): { error: string; warning: string } {
  if (!expiry || isNaN(expiry.getTime())) return { error: 'Select the expiry date', warning: '' };
  const days = daysUntilExpiry(expiry, now);
  if (days < 0) {
    return { error: 'This date has already passed — the medicine is expired', warning: '' };
  }
  if (localMidnight(expiry) > maxExpiryDate(now)) {
    return { error: `That's more than ${MAX_EXPIRY_YEARS} years away — check the year`, warning: '' };
  }
  if (days === 0) return { error: '', warning: 'Expires today — it can only be used today' };
  if (days <= 30) return { error: '', warning: `Expires in ${days} day${days === 1 ? '' : 's'}` };
  return { error: '', warning: '' };
}

export function validateTotalQuantity(raw: string): string {
  const s = raw.trim();
  if (!s) return 'Enter the total quantity';
  if (!/^\d+$/.test(s)) return 'Use whole numbers only (e.g. 30)';
  const n = Number(s);
  if (n < 1) return 'Total must be at least 1';
  if (n > MAX_QUANTITY) return `Total can't be more than ${MAX_QUANTITY.toLocaleString('en-US')}`;
  return '';
}

export function validateCurrentQuantity(raw: string, totalRaw: string): string {
  const s = raw.trim();
  if (!s) return 'Enter how many you have now';
  if (!/^\d+$/.test(s)) return 'Use whole numbers only (e.g. 28)';
  const n = Number(s);
  if (n > MAX_QUANTITY) return `Can't be more than ${MAX_QUANTITY.toLocaleString('en-US')}`;
  // Only compare against the total once the total itself is valid.
  if (!validateTotalQuantity(totalRaw) && n > Number(totalRaw.trim())) {
    return `Can't be more than the total (${Number(totalRaw.trim())})`;
  }
  return '';
}
