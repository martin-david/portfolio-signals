import type { UserProfileDto } from '@/api/schema';
import type { Fact } from '@/features/holdings/detail';
import { describeInterval, formatDate } from '@/lib/format';

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What the person's plan gives them, as the API reports it. */
export function planFacts(me: UserProfileDto): Fact[] {
  return [
    { label: 'Plan', value: me.plan },
    { label: 'eToro syncs', value: sentence(describeInterval(me.etoroSyncIntervalMinutes)) },
    { label: 'TipRanks syncs', value: sentence(describeInterval(me.tipRanksSyncIntervalMinutes)) },
    { label: 'Sync now', value: me.allowsManualSync ? 'Included' : 'Not included' },
    { label: 'Member since', value: formatDate(me.registeredAt) },
  ];
}
