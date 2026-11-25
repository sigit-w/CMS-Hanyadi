const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function waDigits(value) {
  if (value === undefined || value === null) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Nomor WA harus terdiri dari 8 sampai 15 digit angka');
  }
  return digits;
}

export function jakartaClock(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const dayOfYear = cumulative[month] + day + (leap && month > 1 ? 1 : 0);
  return { dayOfYear, hour: local.getUTCHours() };
}

export function generateParticipantUsername(kodeJenjang, wa, value = new Date()) {
  const code = String(kodeJenjang ?? '').trim().toUpperCase();
  const digits = waDigits(wa);
  if (!code || !digits) return null;
  const { dayOfYear, hour } = jakartaClock(value);
  const middle = String((dayOfYear - 1) * 24 + hour).padStart(4, '0');
  const suffix = digits.slice(-4).padStart(4, '0');
  return `${code}${middle}${suffix}`;
}

export function formatJakartaDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const pad = (part) => String(part).padStart(2, '0');
  return [
    local.getUTCFullYear(),
    pad(local.getUTCMonth() + 1),
    pad(local.getUTCDate())
  ].join('-') + ' ' + [
    pad(local.getUTCHours()),
    pad(local.getUTCMinutes()),
    pad(local.getUTCSeconds())
  ].join(':');
}
