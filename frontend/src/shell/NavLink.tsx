import { Link } from 'expo-router';
import { forwardRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Icon, Text, colors, layout, space } from '@/ui';

import type { NavItem } from './navItems';

type PressableRef = ComponentRef<typeof Pressable>;

interface NavButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  item: NavItem;
  active: boolean;
}

/** react-native-web understands aria-current, which the native view types do not list. */
function currentPage(active: boolean): Record<string, unknown> | undefined {
  return Platform.OS === 'web' && active ? { 'aria-current': 'page' } : undefined;
}

// Link hands its child an address, a press handler and a merged style that cannot carry a style function, so these
// components draw themselves and forward only what Link gave them.
const TopNavButton = forwardRef<PressableRef, NavButtonProps>(function TopNavButton(
  { item, active, ...forwarded },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...forwarded}
      ref={ref}
      role="link"
      accessibilityLabel={item.label}
      {...currentPage(active)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.top, hovered && !active && styles.topHover]}
    >
      <Text variant={active ? 'bodyStrong' : 'body'} tone={active ? 'ink' : 'muted'}>
        {item.label}
      </Text>
      {active ? <View style={styles.underline} /> : null}
    </Pressable>
  );
});

const BottomNavButton = forwardRef<PressableRef, NavButtonProps>(function BottomNavButton(
  { item, active, ...forwarded },
  ref,
) {
  const color = active ? colors.ink : colors.ink3;
  return (
    <Pressable
      {...forwarded}
      ref={ref}
      // Link passes role="link", which outranks accessibilityRole; on a phone this is a tab of the bottom bar.
      role={Platform.OS === 'web' ? 'link' : 'tab'}
      accessibilityLabel={item.label}
      accessibilityState={Platform.OS === 'web' ? undefined : { selected: active }}
      {...currentPage(active)}
      style={styles.bottom}
    >
      <View style={[styles.pill, active && styles.pillActive]}>
        <Icon name={active ? item.activeIcon : item.icon} size={24} color={color} />
      </View>
      <Text variant="label" style={{ color }}>
        {item.label}
      </Text>
    </Pressable>
  );
});

/** A destination in the top bar: a word, underlined when it is the current one. */
export function TopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} asChild>
      <TopNavButton item={item} active={active} />
    </Link>
  );
}

/** A destination in the bottom bar: an icon on a pill that fills when it is the current one, with its word below. */
export function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} asChild>
      <BottomNavButton item={item} active={active} />
    </Link>
  );
}

const styles = StyleSheet.create({
  top: {
    height: 56,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHover: { backgroundColor: colors.paper },
  underline: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 0,
    height: 3,
    backgroundColor: colors.ink,
  },
  bottom: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  pill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: layout.minTarget,
  },
  pillActive: { backgroundColor: colors.slateBg },
});
