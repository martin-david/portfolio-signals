import { Link, usePathname } from 'expo-router';
import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRefreshWhenSyncCompletes } from '@/features/sync/hooks';
import { Text, colors, gutterFor, layout, space, useBreakpoint } from '@/ui';

import { DemoNotice } from './DemoNotice';
import { HideAmountsButton } from './HideAmountsButton';
import { BottomNavLink, TopNavLink } from './NavLink';
import { METHOD_ITEM, NAV_ITEMS, isActive } from './navItems';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';

function TopBar({ wide }: { wide: boolean }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const breakpoint = useBreakpoint();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <View style={[styles.topInner, { paddingHorizontal: gutterFor(breakpoint) }]}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Portfolio Signals, overview"
            style={styles.brand}
          >
            <Text variant="heading">Portfolio Signals</Text>
          </Pressable>
        </Link>
        {wide ? (
          <View role="navigation" aria-label="Main" style={styles.topNav}>
            {[...NAV_ITEMS, METHOD_ITEM].map((item) => (
              <TopNavLink key={item.key} item={item} active={isActive(pathname, item.href)} />
            ))}
          </View>
        ) : (
          <View style={styles.spacer} />
        )}
        <HideAmountsButton showLabel={breakpoint !== 'compact'} />
      </View>
    </View>
  );
}

function BottomBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  return (
    <View
      role="navigation"
      aria-label="Main"
      accessibilityRole={Platform.OS === 'web' ? undefined : 'tablist'}
      style={[styles.bottomBar, { paddingBottom: insets.bottom }]}
    >
      {NAV_ITEMS.map((item) => (
        <BottomNavLink key={item.key} item={item} active={isActive(pathname, item.href)} />
      ))}
    </View>
  );
}

/** The signed-in chrome: top bar everywhere, bottom bar below the wide breakpoint, the screen in between. */
export function AppFrame({ children }: { children: ReactNode }) {
  useRefreshWhenSyncCompletes();
  const wide = useBreakpoint() === 'wide';
  return (
    <View style={styles.frame}>
      <SkipLink />
      <TopBar wide={wide} />
      <DemoNotice />
      <View nativeID={MAIN_CONTENT_ID} role="main" tabIndex={-1} style={styles.main}>
        {children}
      </View>
      {wide ? null : <BottomBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.paper },
  main: { flex: 1 },
  topBar: {
    backgroundColor: colors.sheet,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  topInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: { minHeight: layout.minTarget, justifyContent: 'center' },
  topNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginLeft: space.xxl,
  },
  spacer: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
});
