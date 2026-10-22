import { createDemoData } from './demoPortfolio';

const DAY = 86_400_000;
/** A Monday. The demo is opened on any day, so each test walks through a week from here. */
const MONDAY = Date.UTC(2026, 9, 12, 12);
const WEEK = [0, 1, 2, 3, 4, 5, 6];

function reports(openedOn: number) {
  const now = new Date(openedOn);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return createDemoData(now).holdings.flatMap(({ holding, signals }) =>
    Object.values(signals).flatMap((signal) =>
      signal.nextEarningsDate
        ? [
            {
              symbol: holding.symbol,
              date: signal.nextEarningsDate,
              inDays: Math.round(
                (Date.parse(`${signal.nextEarningsDate}T00:00:00Z`) - today) / DAY,
              ),
            },
          ]
        : [],
    ),
  );
}

describe.each(WEEK)('the demo portfolio opened %i days into a week', (offset) => {
  const openedOn = MONDAY + offset * DAY;

  it('has every company report on a weekday', () => {
    const found = reports(openedOn);

    expect(found.length).toBeGreaterThan(10);
    for (const { symbol, date } of found) {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      expect([symbol, weekday >= 1 && weekday <= 5]).toEqual([symbol, true]);
    }
  });

  it('keeps the same holdings reporting within 30 days, and all of them within the 70 days the chart shows', () => {
    const within30 = (day: number) =>
      reports(day)
        .filter((report) => report.inDays <= 30)
        .map((report) => report.symbol)
        .sort();

    expect(within30(openedOn)).toEqual(within30(MONDAY));
    expect(within30(openedOn)).toEqual(expect.arrayContaining(['NWND', 'CTSO', 'WGTP']));
    for (const { inDays } of reports(openedOn)) {
      expect(inDays).toBeGreaterThanOrEqual(0);
      expect(inDays).toBeLessThanOrEqual(70);
    }
  });
});
