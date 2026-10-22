import { StyleSheet, View } from 'react-native';

import { Band, Button, ErrorState, Heading, Screen, layout, space } from '@/ui';

export interface BootErrorScreenProps {
  error: unknown;
  onRetry: () => void;
  onSignOut: () => void;
}

/** The profile could not be read, so the app cannot tell where to send the user: say so, and offer a way out. */
export function BootErrorScreen({ error, onRetry, onSignOut }: BootErrorScreenProps) {
  return (
    <Screen centered>
      <Band first padding="roomy">
        <View style={styles.card}>
          <Heading level={1}>Portfolio Signals</Heading>
          <ErrorState error={error} title="Couldn't open your account" onRetry={onRetry} />
          <Button variant="quiet" onPress={onSignOut}>
            Sign out
          </Button>
        </View>
      </Band>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: layout.maxContentWidth / 3,
    alignSelf: 'center',
    gap: space.lg,
  },
});
