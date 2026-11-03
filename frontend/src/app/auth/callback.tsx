import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { LoadingScreen } from '@/shell/LoadingScreen';
import { PlainFrame } from '@/shell/PlainFrame';

// The sign-in popup of the web build lands here. expo-auth-session reads the result from this window's address
// (see maybeCompleteAuthSession in src/auth/expoOidcClient.ts) and closes it. If the window is still open after a
// moment, the popup was blocked or the result never arrived, so go back to the start.
const GIVE_UP_AFTER_MS = 8000;

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), GIVE_UP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <PlainFrame>
      <LoadingScreen label="Finishing sign-in" />
    </PlainFrame>
  );
}
