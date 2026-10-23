export function normalizeIndianPhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (String(value || '').trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new Error('Enter a valid mobile number with country code, or a 10-digit Indian mobile number.');
}

export function sameIndianPhone(first, second) {
  try { return normalizeIndianPhone(first) === normalizeIndianPhone(second); }
  catch { return false; }
}
