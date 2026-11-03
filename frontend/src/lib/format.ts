/**
 * Formatting helpers. They do not use Intl on purpose: Hermes does not implement all of it, and the same input must
 * read the same on web, Android and in tests. Negative numbers use the real minus sign (U+2212) as the prototype does.
 */

export const MINUS = '\u2212';
const MISSING = '\u2013';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
  JPY: '\u00a5',
};

const SMALL_NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parts(value: number, decimals: number): { negative: boolean; body: string } {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split('.');
  const body = fraction ? `${group(integer)}.${fraction}` : group(integer);
  return { negative: value < 0 && Number(fixed) !== 0, body };
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  const { negative, body } = parts(value, decimals);
  return negative ? `${MINUS}${body}` : body;
}

function currencyPrefix(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function formatMoney(
  value: number | null | undefined,
  currency = 'USD',
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  const { negative, body } = parts(value, decimals);
  return `${negative ? MINUS : ''}${currencyPrefix(currency)}${body}`;
}

/** +$1,234 or \u2212$1,234; no sign for zero. */
export function formatSignedMoney(
  value: number | null | undefined,
  currency = 'USD',
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  const { negative, body } = parts(value, decimals);
  const isZero = Number(Math.abs(value).toFixed(decimals)) === 0;
  const sign = isZero ? '' : negative ? MINUS : '+';
  return `${sign}${currencyPrefix(currency)}${body}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  const { negative, body } = parts(value, decimals);
  return `${negative ? MINUS : ''}${body}%`;
}

/** +12.3% or \u22124.2%; zero reads 0.0%. */
export function formatSignedPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MISSING;
  }
  const { negative, body } = parts(value, decimals);
  const isZero = Number(Math.abs(value).toFixed(decimals)) === 0;
  return `${isZero ? '' : negative ? MINUS : '+'}${body}%`;
}

/** The prototype spells out small counts ("three positions"). */
export function words(count: number): string {
  return Number.isInteger(count) && count >= 0 && count < SMALL_NUMBERS.length
    ? SMALL_NUMBERS[count]
    : String(count);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** 30 Sep 2026, in UTC so that the same snapshot reads the same everywhere. */
export function formatDate(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date
    ? `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : MISSING;
}

/** Sep 30 */
export function formatShortDate(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}` : MISSING;
}

/** Wed Nov 4 */
export function formatDayLabel(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? `${WEEKDAYS[date.getUTCDay()]} ${formatShortDate(value)}` : MISSING;
}

/** 30 Sep 2026, 20:36 UTC */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date
    ? `${formatDate(value)}, ${two(date.getUTCHours())}:${two(date.getUTCMinutes())} UTC`
    : MISSING;
}

function unit(count: number, name: string): string {
  return `${count} ${name}${count === 1 ? '' : 's'}`;
}

/** "5 minutes ago", "in 2 days", "just now". Older than two weeks falls back to the date. */
export function formatRelative(value: string | null | undefined, now: Date): string {
  const date = parseInstant(value);
  if (!date) {
    return MISSING;
  }
  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const minutes = Math.abs(diffMs) / 60_000;
  if (minutes < 1) {
    return 'just now';
  }
  let text: string;
  if (minutes < 60) {
    text = unit(Math.round(minutes), 'minute');
  } else if (minutes < 60 * 24) {
    text = unit(Math.round(minutes / 60), 'hour');
  } else if (minutes < 60 * 24 * 14) {
    text = unit(Math.round(minutes / (60 * 24)), 'day');
  } else {
    return formatDate(value);
  }
  return future ? `in ${text}` : `${text} ago`;
}

/** Sync interval in plain words: weekly, daily, every 6 hours, hourly. */
export function describeInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return MISSING;
  }
  if (minutes === 60) {
    return 'hourly';
  }
  if (minutes === 1440) {
    return 'daily';
  }
  if (minutes === 10080) {
    return 'weekly';
  }
  if (minutes % 1440 === 0) {
    return `every ${unit(minutes / 1440, 'day')}`;
  }
  if (minutes % 60 === 0) {
    return `every ${unit(minutes / 60, 'hour')}`;
  }
  return `every ${unit(minutes, 'minute')}`;
}
