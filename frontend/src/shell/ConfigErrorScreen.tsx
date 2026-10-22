import { Platform, StyleSheet, View } from 'react-native';

import { Band, Heading, Panel, Screen, Text, colors, fonts, space } from '@/ui';

const monospace = Platform.select({
  web: 'ui-monospace, Menlo, Consolas, monospace',
  default: 'monospace',
});

/** The build's settings are invalid. Only developers see this, so it names the variables outright. */
export function ConfigErrorScreen({ errors }: { errors: readonly string[] }) {
  return (
    <Screen>
      <Band first padding="roomy">
        <View style={styles.content}>
          <Heading level={1}>This build is not configured</Heading>
          <Text>
            The app cannot start because its settings are not valid. Fix them in the environment
            (frontend/.env.example lists every setting) and start the app again.
          </Text>
          <Panel>
            <View style={styles.list}>
              {errors.map((error) => (
                <Text key={error} variant="small" style={styles.error}>
                  {error}
                </Text>
              ))}
            </View>
          </Panel>
        </View>
      </Band>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg, maxWidth: 720 },
  list: { gap: space.sm },
  error: { fontFamily: monospace ?? fonts.ui, color: colors.crimson },
});
