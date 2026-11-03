import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PageTitle } from '@/shell/PageTitle';
import { PlainFrame } from '@/shell/PlainFrame';
import { Band, Heading, Screen, Text, colors, layout, space, typeScale } from '@/ui';

export default function NotFound() {
  return (
    <PlainFrame>
      <Screen centered>
        <PageTitle title="Page not found" />
        <Band first padding="roomy">
          <View style={styles.column}>
            <Heading level={1} variant="title">
              This page does not exist
            </Heading>
            <Text tone="muted">The address may have changed, or it may have been mistyped.</Text>
            <Link href="/" style={styles.link}>
              Go to the start
            </Link>
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
  link: {
    ...typeScale.bodyStrong,
    color: colors.blue,
    textDecorationLine: 'underline',
    paddingVertical: space.md,
    alignSelf: 'flex-start',
  },
});
