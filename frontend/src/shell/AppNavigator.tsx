import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAuth } from '@/auth';
import { colors } from '@/ui';

import { BootErrorScreen } from './BootErrorScreen';
import type { BootPhase } from './bootPhase';
import { LoadingScreen } from './LoadingScreen';
import { PlainFrame } from './PlainFrame';
import { useBoot } from './useBoot';

/** Called once the app has something of its own to show, so the native splash screen can make way. */
export type OnReady = () => void;

function Routes({ phase }: { phase: BootPhase }) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Protected guard={phase === 'signed-out'}>
        <Stack.Screen name="(public)/sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'needs-profile'}>
        <Stack.Screen name="(onboarding)/profile" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'ready'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

/**
 * Decides what the app shows. Screens of a group exist only while their guard holds, so nobody reaches a screen by
 * typing its address: a signed-out visitor to /holdings is sent to sign in, a signed-in one to /sign-in is sent home.
 */
export function AppNavigator({ fontsReady, onReady }: { fontsReady: boolean; onReady: OnReady }) {
  const { signOut } = useAuth();
  const { phase, error, retry } = useBoot(fontsReady);
  const settled = phase !== 'booting';

  useEffect(() => {
    if (settled) {
      onReady();
    }
  }, [settled, onReady]);

  return (
    <>
      <StatusBar style="dark" />
      {phase === 'booting' ? (
        <LoadingScreen />
      ) : phase === 'opening-account' ? (
        <PlainFrame>
          <LoadingScreen
            label="Opening your account"
            slowHint="Still waiting for the server. If it has been idle, it can take a little while to start."
          />
        </PlainFrame>
      ) : phase === 'account-error' ? (
        <PlainFrame>
          <BootErrorScreen error={error} onRetry={retry} onSignOut={() => void signOut()} />
        </PlainFrame>
      ) : (
        <Routes phase={phase} />
      )}
    </>
  );
}
