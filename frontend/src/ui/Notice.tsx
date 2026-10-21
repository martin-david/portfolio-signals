import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';

import { Button } from './Button';
import { Text } from './Text';
import { colors, radius, space } from './tokens';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

export interface NoticeAction {
  label: string;
  onPress: () => void;
}

export interface NoticeProps {
  tone?: NoticeTone;
  title: string;
  children?: string;
  action?: NoticeAction;
  testID?: string;
}

const palette: Record<
  NoticeTone,
  { background: string; accent: string; icon: string; word: string }
> = {
  info: {
    background: colors.slateBg,
    accent: colors.ink2,
    icon: 'information-outline',
    word: 'Note',
  },
  warning: {
    background: colors.amberBg,
    accent: colors.amber,
    icon: 'alert-outline',
    word: 'Warning',
  },
  danger: {
    background: colors.crimsonBg,
    accent: colors.crimson,
    icon: 'alert-circle-outline',
    word: 'Problem',
  },
  success: {
    background: colors.tealBg,
    accent: colors.tealDark,
    icon: 'check-circle-outline',
    word: 'Done',
  },
};

/** A message about the state of the data or an action. Tone is carried by an icon and a word as well as colour. */
export function Notice({ tone = 'info', title, children, action, testID }: NoticeProps) {
  const style = palette[tone];
  return (
    <View
      testID={testID}
      accessible={tone === 'danger' && !action ? true : undefined}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[styles.box, { backgroundColor: style.background }]}
    >
      <View style={styles.icon} importantForAccessibility="no-hide-descendants">
        <Icon source={style.icon} size={22} color={style.accent} />
      </View>
      <View style={styles.body}>
        <Text
          variant="smallStrong"
          accessibilityLabel={`${style.word}: ${title}`}
          style={{ color: style.accent }}
        >
          {title}
        </Text>
        {children ? <Text variant="small">{children}</Text> : null}
        {action ? (
          <View style={styles.action}>
            <Button variant="secondary" onPress={action.onPress}>
              {action.label}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  icon: { paddingTop: 1 },
  body: { flex: 1, gap: space.xs },
  action: { alignSelf: 'flex-start', marginTop: space.sm },
});
