import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SyncRunDto, SyncRunStatus } from '@/api/schema';
import { describeRun } from '@/features/sync/history';
import { plural } from '@/lib/format';
import { Button, StatusLabel, Text, colors, space } from '@/ui';

const STATUS_ICON: Partial<Record<SyncRunStatus, string>> = {
  Queued: 'clock-outline',
  Running: 'sync',
  Skipped: 'skip-next-circle-outline',
};

/** The runs shown before "Show all". */
export const HISTORY_PREVIEW = 6;

export interface SyncHistoryProps {
  runs: readonly SyncRunDto[];
  now: Date;
  preview?: number;
}

/** What the app asked of each provider and how it went, newest first. */
export function SyncHistory({ runs, now, preview = HISTORY_PREVIEW }: SyncHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? runs : runs.slice(0, preview);
  const hidden = runs.length - shown.length;

  return (
    <View style={styles.list}>
      <View role="list" testID="sync-history">
        {shown.map((run) => {
          const described = describeRun(run, now);
          return (
            <View key={run.id} role="listitem" testID={`sync-run-${run.id}`} style={styles.row}>
              <View style={styles.main}>
                <Text variant="bodyStrong">{described.title}</Text>
                <Text variant="small" tone="muted">
                  {described.detail}
                </Text>
              </View>
              <View style={styles.meta}>
                <StatusLabel tone={described.tone} icon={STATUS_ICON[run.status]}>
                  {described.statusLabel}
                </StatusLabel>
                <Text variant="caption" tone="subtle">
                  {`${described.when} · ${described.whenExact}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {runs.length > preview ? (
        <View style={styles.more}>
          <Button variant="quiet" onPress={() => setExpanded((value) => !value)}>
            {expanded ? 'Show fewer' : `Show ${hidden} more ${plural(hidden, 'run')}`}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 260, gap: space.xxs },
  meta: { flexGrow: 0, flexShrink: 1, flexBasis: 290, gap: space.xxs },
  more: { alignItems: 'flex-start' },
});
