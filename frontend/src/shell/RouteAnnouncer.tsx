import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

/** The screen sets its title a moment after the route changes, so the announcement waits for it. */
const SETTLE_MS = 150;

/**
 * Tells a screen reader which screen it has landed on after a link was followed. A page load announces itself; a route
 * change inside the app does not, and the title in the tab is not read out. This reads the new title out, politely.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [message, setMessage] = useState('');
  const first = useRef(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => setMessage(document.title), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <View
      role="status"
      aria-live="polite"
      aria-atomic
      style={styles.hidden}
      testID="route-announcer"
    >
      <Text>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0.01 },
});
