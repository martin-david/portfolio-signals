import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { FactList } from '@/features/holdings/FactList';
import { DISCLAIMER } from '@/features/method/content';
import { useMe } from '@/features/profile/hooks';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { usePreferences } from '@/lib/preferences';
import { PageTitle } from '@/shell/PageTitle';
import { LinkText, RouteLink } from '@/shell/RouteLink';
import {
  Band,
  Button,
  EmptyState,
  ErrorState,
  Grid,
  Heading,
  LoadingRegion,
  Panel,
  Screen,
  SkeletonBlock,
  Text,
  Toggle,
  space,
  useBreakpoint,
  useToast,
} from '@/ui';

import { planFacts } from './plan';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View role="group" accessibilityLabel={title} style={styles.section}>
      <Heading level={2} variant="heading">
        {title}
      </Heading>
      {children}
    </View>
  );
}

/** Who the account is, what the plan gives, how this device shows numbers, and the way out. */
export function SettingsScreen() {
  const wide = useBreakpoint() !== 'compact';
  const toast = useToast();
  const { signOut } = useAuth();
  const { preferences, setHideAmounts } = usePreferences();
  const me = useMe();
  const version = Constants.expoConfig?.version;

  function account() {
    if (me.isPending) {
      return (
        <LoadingRegion label="Loading your account">
          <SkeletonBlock height={220} />
        </LoadingRegion>
      );
    }
    if (me.isError) {
      return (
        <ErrorState
          error={me.error}
          title="Couldn't load your account"
          onRetry={() => void me.refetch()}
        />
      );
    }
    if (me.data === null) {
      return (
        <EmptyState title="Your account is not set up yet">
          Sign out and sign in again to set it up.
        </EmptyState>
      );
    }
    const profile = me.data;
    return (
      <Grid columns={wide ? 2 : 1} rowGap={space.xl}>
        <Section title="Your details">
          <Panel padding="roomy">
            <ProfileForm
              initial={{ displayName: profile.displayName, email: profile.email }}
              submitLabel="Save changes"
              requireChange
              onSaved={() => toast.show('Details saved.')}
            />
          </Panel>
        </Section>
        <Section title="Your plan">
          <Panel>
            <FactList facts={planFacts(profile)} testID="plan" />
          </Panel>
          <Text variant="small" tone="muted" testID="plan-note">
            Your plan sets how often your data is brought up to date. Changing plan is not possible
            in the app yet.
          </Text>
        </Section>
      </Grid>
    );
  }

  return (
    <Screen>
      <PageTitle title="Settings" />
      <Band first>
        <View style={styles.section}>
          <Heading level={1}>Settings</Heading>
          <Text tone="muted" style={styles.lede}>
            Your account, your plan and how this device shows your numbers.
          </Text>
        </View>
      </Band>

      <Band tone="sheet">{account()}</Band>

      <Band>
        <Grid columns={wide ? 2 : 1} rowGap={space.xl}>
          <Section title="On this device">
            <Toggle
              label="Hide amounts on this device"
              description="Shows your own money amounts as dots until you turn this off. Percentages and market prices stay visible. The choice is remembered on this device."
              value={preferences.hideAmounts}
              onValueChange={setHideAmounts}
              testID="hide-amounts-setting"
            />
          </Section>
          <Section title="About">
            <RouteLink href="/method">
              <LinkText>How verdicts are decided</LinkText>
            </RouteLink>
            <Text variant="small" tone="subtle" testID="disclaimer">
              {DISCLAIMER}
            </Text>
            {version ? (
              <Text variant="small" tone="subtle" testID="version">
                {`Portfolio Signals ${version}`}
              </Text>
            ) : null}
          </Section>
        </Grid>
      </Band>

      <Band tone="sheet" padding="tight">
        <View style={styles.signOut}>
          <Button variant="secondary" icon="logout" onPress={() => void signOut()}>
            Sign out
          </Button>
        </View>
      </Band>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  lede: { maxWidth: 720 },
  signOut: { alignItems: 'flex-start' },
});
