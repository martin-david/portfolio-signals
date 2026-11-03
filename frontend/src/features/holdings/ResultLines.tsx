import { StyleSheet, View } from 'react-native';

import type { AnalyzedHoldingDto } from '@/api/schema';
import { signalLines } from '@/features/portfolio/signals';
import { formatSignedPercent } from '@/lib/format';
import { Amount, Text, space } from '@/ui';

export interface ResultLinesProps {
  row: AnalyzedHoldingDto;
  currency: string;
  /** The signals in words, for layouts where the row cannot hold the bars. */
  withSignals: boolean;
  /** The result against the person's cost, for layouts where the row has no column for it. */
  withResult: boolean;
}

/** What the columns that did not fit would have said: the signals in words, and how the position stands against cost. */
export function ResultLines({ row, currency, withSignals, withResult }: ResultLinesProps) {
  const signals = withSignals ? signalLines(row) : [];
  if (signals.length === 0 && !withResult) {
    return null;
  }
  const title =
    signals.length > 0 && withResult ? 'Signals and result' : withResult ? 'Result' : 'Signals';
  return (
    <View role="group" accessibilityLabel={title} style={styles.group} testID="result-lines">
      <Text variant="smallStrong">{title}</Text>
      <View role="list">
        {signals.map((line) => (
          <View key={line} role="listitem">
            <Text variant="small">{line}</Text>
          </View>
        ))}
        {withResult ? (
          <View role="listitem">
            <Text variant="small">
              {`${formatSignedPercent(row.holding.pnlPct)} against your cost (`}
              <Amount
                value={row.holding.pnl}
                currency={currency}
                signed
                variant="small"
                decimals={0}
              />
              {')'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
});
