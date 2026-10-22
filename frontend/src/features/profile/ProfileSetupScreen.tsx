import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { PageTitle } from '@/shell/PageTitle';
import { PlainFrame } from '@/shell/PlainFrame';
import { Band, Button, Heading, Panel, Screen, Text, layout, space } from '@/ui';

import { ProfileForm } from './ProfileForm';

/** First sign-in: the API does not know this person yet, so ask for the two details it needs. */
export function ProfileSetupScreen() {
  const { suggestedProfile, signOut } = useAuth();
  return (
    <PlainFrame>
      <Screen centered>
        <PageTitle title="Set up your account" />
        <Band first padding="roomy">
          <View style={styles.column}>
            <Heading level={1} variant="title">
              Set up your account
            </Heading>
            <Text tone="muted">
              Portfolio Signals needs a name and an e-mail address for your account. You can change
              both later in Settings.
            </Text>
            <Panel padding="roomy">
              <ProfileForm
                initial={suggestedProfile ?? { displayName: '', email: '' }}
                submitLabel="Continue"
              />
            </Panel>
            <Button variant="quiet" onPress={() => void signOut()} style={styles.signOut}>
              Sign out
            </Button>
          </View>
        </Band>
      </Screen>
    </PlainFrame>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth / 2.5,
    alignSelf: 'center',
    gap: space.lg,
  },
  signOut: { alignSelf: 'flex-start' },
});
