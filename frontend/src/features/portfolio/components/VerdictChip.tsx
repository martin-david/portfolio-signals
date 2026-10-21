import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Verdict } from '@/api/schema';
import { Text } from '@/ui/Text';
import { verdictChip } from '@/ui/tokens';

import { verdictMeta, type ChipKind } from '../verdicts';

/** The prototype's glyphs: check, half circle, triangle, dash. They carry the verdict as well as the colour does. */
export function VerdictGlyph({
  kind,
  color,
  size = 12,
}: {
  kind: ChipKind;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'hold' ? (
        <Path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke={color} strokeWidth={1.8} />
      ) : null}
      {kind === 'watch' ? (
        <>
          <Circle cx={6} cy={6} r={4.4} fill="none" stroke={color} strokeWidth={1.3} />
          <Path d="M6 1.6a4.4 4.4 0 010 8.8z" fill={color} />
        </>
      ) : null}
      {kind === 'review' ? <Path d="M6 1.4l5.2 9.2H.8z" fill={color} /> : null}
      {kind === 'nodata' ? <Path d="M2.4 6h7.2" stroke={color} strokeWidth={1.8} /> : null}
    </Svg>
  );
}

/** A verdict as glyph and word. Never colour alone. */
export function VerdictChip({ verdict, testID }: { verdict: Verdict; testID?: string }) {
  const meta = verdictMeta[verdict];
  const palette = verdictChip[meta.chip];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Verdict: ${meta.name}`}
      style={[styles.chip, { backgroundColor: palette.background }]}
    >
      <VerdictGlyph kind={meta.chip} color={palette.text} />
      <Text variant="chip" style={{ color: palette.text }} importantForAccessibility="no">
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 3,
  },
});
