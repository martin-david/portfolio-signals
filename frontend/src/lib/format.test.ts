import {
  MINUS,
  capitalize,
  describeInterval,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
  formatShortDate,
  formatSignedMoney,
  formatSignedPercent,
  plural,
  words,
} from './format';

describe('numbers', () => {
  it('groups thousands and uses the real minus sign', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(-1234.5, 1)).toBe(`${MINUS}1,234.5`);
    expect(formatNumber(0.04, 1)).toBe('0.0');
    expect(formatNumber(-0.04, 1)).toBe('0.0');
  });

  it('shows a dash for missing values', () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatNumber(value)).toBe('\u2013');
      expect(formatMoney(value)).toBe('\u2013');
      expect(formatPercent(value)).toBe('\u2013');
      expect(formatSignedPercent(value)).toBe('\u2013');
      expect(formatSignedMoney(value)).toBe('\u2013');
    }
  });
});

describe('money', () => {
  it('formats amounts with the currency symbol', () => {
    expect(formatMoney(12345)).toBe('$12,345');
    expect(formatMoney(-12345.5, 'USD', 2)).toBe(`${MINUS}$12,345.50`);
    expect(formatMoney(1500, 'EUR')).toBe('\u20ac1,500');
    expect(formatMoney(1500, 'GBP')).toBe('\u00a31,500');
  });

  it('prefixes an unknown currency with its code', () => {
    expect(formatMoney(1500, 'CHF')).toBe('CHF 1,500');
  });

  it('signs gains and losses and leaves zero unsigned', () => {
    expect(formatSignedMoney(250)).toBe('+$250');
    expect(formatSignedMoney(-250)).toBe(`${MINUS}$250`);
    expect(formatSignedMoney(0)).toBe('$0');
    expect(formatSignedMoney(-0.2)).toBe('$0');
  });
});

describe('percentages', () => {
  it('formats plain and signed percentages', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
    expect(formatPercent(-4.25, 2)).toBe(`${MINUS}4.25%`);
    expect(formatSignedPercent(12.34)).toBe('+12.3%');
    expect(formatSignedPercent(-4.2)).toBe(`${MINUS}4.2%`);
    expect(formatSignedPercent(0)).toBe('0.0%');
    expect(formatSignedPercent(-0.04)).toBe('0.0%');
    expect(formatSignedPercent(7, 0)).toBe('+7%');
  });
});

describe('words', () => {
  it('spells out small counts', () => {
    expect(words(0)).toBe('zero');
    expect(words(3)).toBe('three');
    expect(words(12)).toBe('twelve');
    expect(words(13)).toBe('13');
    expect(words(-1)).toBe('-1');
    expect(words(1.5)).toBe('1.5');
    expect(capitalize(words(3))).toBe('Three');
    expect(capitalize('')).toBe('');
  });

  it('chooses singular or plural', () => {
    expect(plural(1, 'position')).toBe('position');
    expect(plural(2, 'position')).toBe('positions');
    expect(plural(0, 'analyst')).toBe('analysts');
    expect(plural(2, 'company', 'companies')).toBe('companies');
  });
});

describe('dates', () => {
  it('formats in UTC', () => {
    expect(formatDate('2026-09-30T23:30:00Z')).toBe('30 Sep 2026');
    expect(formatShortDate('2026-10-05')).toBe('Oct 5');
    expect(formatDateTime('2026-09-30T20:36:12Z')).toBe('30 Sep 2026, 20:36 UTC');
    expect(formatDateTime('2026-01-02T03:04:00+02:00')).toBe('2 Jan 2026, 01:04 UTC');
  });

  it('shows a dash for missing or invalid dates', () => {
    for (const value of [null, undefined, '', 'not a date']) {
      expect(formatDate(value)).toBe('\u2013');
      expect(formatShortDate(value)).toBe('\u2013');
      expect(formatDateTime(value)).toBe('\u2013');
      expect(formatRelative(value, new Date())).toBe('\u2013');
    }
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it.each([
    ['2026-10-21T11:59:40Z', 'just now'],
    ['2026-10-21T11:59:00Z', '1 minute ago'],
    ['2026-10-21T11:15:00Z', '45 minutes ago'],
    ['2026-10-21T10:00:00Z', '2 hours ago'],
    ['2026-10-21T11:00:00Z', '1 hour ago'],
    ['2026-10-18T12:00:00Z', '3 days ago'],
    ['2026-10-01T12:00:00Z', '1 Oct 2026'],
    ['2026-10-21T12:00:30Z', 'just now'],
    ['2026-10-21T12:05:00Z', 'in 5 minutes'],
    ['2026-10-21T18:00:00Z', 'in 6 hours'],
    ['2026-10-23T12:00:00Z', 'in 2 days'],
  ])('%s reads %s', (value, expected) => {
    expect(formatRelative(value, now)).toBe(expected);
  });
});

describe('describeInterval', () => {
  it.each([
    [60, 'hourly'],
    [360, 'every 6 hours'],
    [1440, 'daily'],
    [10080, 'weekly'],
    [2880, 'every 2 days'],
    [15, 'every 15 minutes'],
    [90, 'every 90 minutes'],
    [0, '\u2013'],
  ])('%i minutes reads %s', (minutes, expected) => {
    expect(describeInterval(minutes)).toBe(expected);
  });
});
