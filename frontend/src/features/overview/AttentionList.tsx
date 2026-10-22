import { StyleSheet, View } from 'react-native';

import { RouteLink } from '@/shell/RouteLink';
import type { AttentionItem } from '@/features/portfolio/narrative';
import { VerdictChip } from '@/features/portfolio/components/VerdictChip';
import { verdictMeta } from '@/features/portfolio/verdicts';
import { formatPercent } from '@/lib/format';
import { Icon, Panel, Text, colors, space } from '@/ui';

function reasonsOf(item: AttentionItem): string {
  if (item.reasons.length > 0) {
    return item.reasons.join(' · ');
  }
  return item.verdict === 'HoldReviewSize' ? 'A hold, but large enough to review its size.' : '';
}

export interface AttentionListProps {
  items: readonly AttentionItem[];
}

/** The positions worth a second look, biggest first. Each row opens that holding. */
export function AttentionList({ items }: AttentionListProps) {
  return (
    <Panel padding="none" testID="attention-list">
      <View role="list">
        {items.map((item, index) => {
          const reasons = reasonsOf(item);
          return (
            <View
              key={item.symbol}
              role="listitem"
              style={index > 0 ? styles.separated : undefined}
            >
              <RouteLink
                appearance="row"
                href={{ pathname: '/holdings/[symbol]', params: { symbol: item.symbol } }}
                testID={`attention-${item.symbol}`}
                accessibilityLabel={[
                  `${item.symbol}, ${item.name}.`,
                  `${verdictMeta[item.verdict].name}, ${formatPercent(item.weightPct)} of your account.`,
                  reasons,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <View style={styles.row}>
                  <View style={styles.main}>
                    <View style={styles.top}>
                      <Text numberOfLines={1} style={styles.identity}>
                        <Text variant="bodyStrong">{item.symbol}</Text>
                        <Text variant="small" tone="muted">
                          {`\u00a0\u00a0${item.name}`}
                        </Text>
                      </Text>
                      <View style={styles.verdict}>
                        <VerdictChip verdict={item.verdict} />
                      </View>
                      <Text variant="smallStrong" style={styles.weight}>
                        {`${formatPercent(item.weightPct)} of account`}
                      </Text>
                    </View>
                    {reasons ? (
                      <Text variant="small" tone="muted">
                        {reasons}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.ink3} />
                </View>
              </RouteLink>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  main: { flex: 1, gap: space.xs },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  identity: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  verdict: { width: 124, alignItems: 'flex-start' },
  weight: { width: 120 },
});
