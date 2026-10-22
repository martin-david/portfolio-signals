import type { UserProfileDto } from '@/api/schema';

import { planFacts } from './plan';

const me: UserProfileDto = {
  id: 'user-1',
  email: 'ada@example.test',
  displayName: 'Ada Byron',
  plan: 'Free',
  etoroSyncIntervalMinutes: 1440,
  tipRanksSyncIntervalMinutes: 10080,
  allowsManualSync: false,
  registeredAt: '2026-03-04T09:30:00Z',
};

describe('planFacts', () => {
  it('says what the plan gives, in words', () => {
    expect(planFacts(me)).toEqual([
      { label: 'Plan', value: 'Free' },
      { label: 'eToro syncs', value: 'Daily' },
      { label: 'TipRanks syncs', value: 'Weekly' },
      { label: 'Sync now', value: 'Not included' },
      { label: 'Member since', value: '4 Mar 2026' },
    ]);
  });

  it('describes the schedule in hours when it is not a whole day or week', () => {
    const facts = planFacts({
      ...me,
      plan: 'Pro',
      etoroSyncIntervalMinutes: 60,
      tipRanksSyncIntervalMinutes: 360,
      allowsManualSync: true,
    });

    expect(facts.map((fact) => fact.value).slice(0, 4)).toEqual([
      'Pro',
      'Hourly',
      'Every 6 hours',
      'Included',
    ]);
  });
});
