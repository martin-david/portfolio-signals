import { StyleSheet, View } from 'react-native';

import { Notice, space } from '@/ui';

import { providerLabel, type FreshnessNotice } from './freshness';

export interface FreshnessNoticesProps {
  notices: readonly FreshnessNotice[];
  /** Called for the notices that say what to do (connect, reconnect). Without it they carry no button. */
  onAction?: (notice: FreshnessNotice) => void;
}

/** What the person should know about the freshness of their data, most urgent first. */
export function FreshnessNotices({ notices, onAction }: FreshnessNoticesProps) {
  if (notices.length === 0) {
    return null;
  }
  return (
    <View style={styles.list} testID="freshness-notices">
      {notices.map((notice) => (
        <Notice
          key={notice.id}
          tone={notice.tone}
          title={notice.title}
          action={
            notice.action && onAction
              ? {
                  label: `${notice.action === 'reconnect' ? 'Reconnect' : 'Connect'} ${providerLabel(notice.provider)}`,
                  onPress: () => onAction(notice),
                }
              : undefined
          }
        >
          {notice.body}
        </Notice>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
});
