import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthError, DEFAULT_DEV_USER, checkDevUser, useAuth } from '@/auth';
import { PageTitle } from '@/shell/PageTitle';
import { PlainFrame } from '@/shell/PlainFrame';
import { Band, Button, Heading, Notice, Panel, Screen, Text, TextField, layout, space } from '@/ui';

const SIGN_IN_FAILED = 'Signing in did not work. Try again.';

/** Where a signed-out person lands. What it offers depends on how this build signs people in. */
export function SignInScreen() {
  const { mode, expired, signIn } = useAuth();
  const [devUser, setDevUser] = useState(DEFAULT_DEV_USER);
  const [devUserError, setDevUserError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function start() {
    setFailure(null);
    if (mode === 'dev') {
      const problem = checkDevUser(devUser);
      setDevUserError(problem ?? undefined);
      if (problem) {
        return;
      }
    }
    setBusy(true);
    try {
      await signIn(mode === 'dev' ? { devUser: devUser.trim() } : undefined);
    } catch (error) {
      setFailure(error instanceof AuthError ? error.message : SIGN_IN_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainFrame>
      <Screen centered>
        <PageTitle title="Sign in" />
        <Band first padding="roomy">
          <View style={styles.column}>
            <View style={styles.intro}>
              <Heading level={1}>Portfolio Signals</Heading>
              <Text tone="muted">
                Analyst signals for every holding in your eToro portfolio, scored by rules you can
                read. See what the data supports and which positions deserve a second look.
              </Text>
            </View>
            <Panel padding="roomy">
              <View style={styles.form}>
                {expired ? (
                  <Notice tone="warning" title="Your session ended">
                    Sign in again to carry on where you left off.
                  </Notice>
                ) : null}
                {failure ? (
                  <Notice tone="danger" title="Couldn't sign you in">
                    {failure}
                  </Notice>
                ) : null}
                {mode === 'mock' ? (
                  <Text tone="muted">
                    The demo uses fictional companies and invented figures. Nothing leaves this
                    device, and the demo starts over each time the app opens.
                  </Text>
                ) : null}
                {mode === 'oidc' ? (
                  <Text tone="muted">
                    You continue on the sign-in page of your identity provider.
                  </Text>
                ) : null}
                {mode === 'dev' ? (
                  <TextField
                    label="Development user name"
                    value={devUser}
                    onChangeText={(value) => {
                      setDevUser(value);
                      setDevUserError(undefined);
                    }}
                    error={devUserError}
                    hint="Any name works. Only a backend running in Development mode accepts it."
                    disabled={busy}
                    onSubmitEditing={() => void start()}
                    testID="sign-in-dev-user"
                  />
                ) : null}
                <Button onPress={() => void start()} loading={busy} testID="sign-in-submit">
                  {mode === 'mock' ? 'Open the demo' : 'Sign in'}
                </Button>
              </View>
            </Panel>
            <Text variant="caption" tone="subtle">
              Informational only. Not investment advice.
            </Text>
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
    gap: space.xl,
  },
  intro: { gap: space.md },
  form: { gap: space.lg },
});
