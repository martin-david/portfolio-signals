import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Heading, Text } from './Text';
import { space } from './tokens';

export interface EmptyStateProps {
  title: string;
  children?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

/** Says what is missing and what to do about it. Left-aligned like the rest of the product, with no illustration. */
export function EmptyState({ title, children, action, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.box}>
      <Heading level={3}>{title}</Heading>
      {children ? (
        <Text tone="muted" style={styles.copy}>
          {children}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button onPress={action.onPress}>{action.label}</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm, alignItems: 'flex-start' },
  copy: { maxWidth: 560 },
  action: { marginTop: space.sm },
});
