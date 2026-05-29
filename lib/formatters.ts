/** NPWP Karyawan: 15 digits → XX.XXX.XXX.X-XXX.XXX */
export function formatNPWP(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 15);
  let out = '';
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 5 || i === 8) out += '.';
    if (i === 9) out += '-';
    out += d[i];
  }
  return out;
}

/** NPWP Perusahaan: 15 OR 16 digits
 *  15 → XX.XXX.XXX.X-XXX.XXX
 *  16 → XX.XXX.XXX.X-XXX.XXX.X
 */
export function formatNPWPCompany(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 16);
  let out = '';
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 5 || i === 8) out += '.';
    if (i === 9) out += '-';
    if (i === 12) out += '.';
    if (i === 15) out += '.';
    out += d[i];
  }
  return out;
}

/** NIK: 16 numeric digits (KTP) OR alphanumeric passport (TKA, max 20 chars).
 *  Strips whitespace + symbols, allows A-Z and 0-9. Uppercase normalization
 *  matches DJP convention for foreign tax-payer identifiers. */
export function formatNIK(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

/** True if value is a valid Indonesian KTP (exactly 16 digits). */
export function isKTP(value: string): boolean {
  return /^\d{16}$/.test(value);
}

/** True if value looks like a foreign passport (alphanumeric, not all digits). */
export function isPassport(value: string): boolean {
  return /[A-Z]/.test(value) && value.length >= 5 && value.length <= 20;
}

/** Nominal: Indonesian thousand separator */
export function formatNominalDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('id-ID');
}

/** Parse back to number string for form */
export function parseNominalToString(display: string): string {
  return display.replace(/\./g, '') || '0';
}

/** Date: dd/mm/yyyy auto-insert slashes */
export function formatDateDMY(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  let out = '';
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 4) out += '/';
    out += d[i];
  }
  return out;
}

/** dd/mm/yyyy → yyyy-mm-dd for Supabase */
export function dmyToISO(dmy: string): string {
  const p = dmy.split('/');
  if (p.length === 3 && p[2].length === 4) {
    return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }
  return '';
}

/** yyyy-mm-dd → dd/mm/yyyy for display */
export function isoToDMY(iso: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return iso;
}
