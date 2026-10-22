import { Tabs } from 'expo-router/js-tabs';

import { AppFrame } from '@/shell/AppFrame';
import { colors } from '@/ui';

/**
 * The navigation bars are drawn by AppFrame, so the navigator only keeps the state: each destination stays as it was
 * left, and Back returns through the places visited. Every screen has to be declared for the navigator to show it.
 */
export default function AppLayout() {
  return (
    <AppFrame>
      <Tabs
        backBehavior="history"
        tabBar={() => null}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="holdings/index" />
        <Tabs.Screen name="holdings/[symbol]" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="connections" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="method" />
      </Tabs>
    </AppFrame>
  );
}
