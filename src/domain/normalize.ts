// Normalization used to compare identifiers. Comparisons are always on both sides normalized.

/** Tax ids: upper case, letters and digits only (RFC, NIT, CNPJ, EIN). */
export function normTaxId(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Invoice numbers: upper case, letters and digits only. */
export function normInvoiceNumber(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Payment accounts (CLABE, Pix key, account numbers): lower case, letters, digits and @ only. */
export function normAccount(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9@]/g, '');
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function cents(n: number): number {
  return Math.round(n * 100);
}

/** Shows the last 4 characters of an account; the rest is masked. */
export function maskAccount(account: string): string {
  const clean = account.trim();
  if (clean.length <= 4) return '••••';
  return `••••${clean.slice(-4)}`;
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso.length === 10 ? `${aIso}T00:00:00Z` : aIso);
  const b = Date.parse(bIso.length === 10 ? `${bIso}T00:00:00Z` : bIso);
  return Math.abs(a - b) / 86_400_000;
}

/** Signed days from a to b (b - a). */
export function daysFromTo(aIso: string, bIso: string): number {
  const a = Date.parse(aIso.length === 10 ? `${aIso}T00:00:00Z` : aIso);
  const b = Date.parse(bIso.length === 10 ? `${bIso}T00:00:00Z` : bIso);
  return (b - a) / 86_400_000;
}

export function periodOf(iso: string): string {
  return iso.slice(0, 7);
}

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** `prefix_` + 26 base32 characters (time-ordered, ULID-like). */
export function newId(prefix: string, now: number = Date.now()): string {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = BASE32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = '';
  for (let i = 0; i < 16; i++) rand += BASE32[Math.floor(Math.random() * 32)];
  return `${prefix}_${time}${rand}`;
}
