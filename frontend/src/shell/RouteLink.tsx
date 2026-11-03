import { Link, type Href } from 'expo-router';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text, colors, isHovered, layout, space } from '@/ui';

type PressableRef = ComponentRef<typeof Pressable>;

interface SurfaceProps extends Omit<PressableProps, 'style' | 'children'> {
  appearance: 'row' | 'text';
  children: ReactNode;
}

// Link hands its child an address, a press handler and a merged style that cannot carry a style function, so the
// surface draws itself and forwards only what Link gave it. On the web this is a real anchor target (right-click,
// open in a new tab); on Android it is a pressable announced as a link.
const Surface = forwardRef<PressableRef, SurfaceProps>(function Surface(
  { appearance, children, ...forwarded },
  ref,
) {
  return (
    <Pressable
      {...forwarded}
      ref={ref}
      role="link"
      style={(state) => [styles[appearance], isHovered(state) && styles[`${appearance}Hovered`]]}
    >
      {children}
    </Pressable>
  );
});

export interface RouteLinkProps {
  href: Href;
  children: ReactNode;
  /** A row fills its width and holds anything; text is a short line in link colour. */
  appearance?: 'row' | 'text';
  accessibilityLabel?: string;
  testID?: string;
}

/** A link to another screen of the app. */
export function RouteLink({
  href,
  children,
  appearance = 'text',
  accessibilityLabel,
  testID,
}: RouteLinkProps) {
  return (
    <Link href={href} asChild>
      <Surface appearance={appearance} accessibilityLabel={accessibilityLabel} testID={testID}>
        {children}
      </Surface>
    </Link>
  );
}

/** The words of a text link. */
export function LinkText({ children }: { children: string }) {
  return (
    <Text variant="bodyStrong" tone="link" style={styles.underlined}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.md, paddingHorizontal: space.lg },
  rowHovered: { backgroundColor: colors.sheetSunken },
  text: { minHeight: layout.minTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  textHovered: { opacity: 0.8 },
  underlined: { textDecorationLine: 'underline' },
});
