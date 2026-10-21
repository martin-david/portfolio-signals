import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { colors } from './tokens';

export type RangeTone = 'good' | 'bad' | 'neutral';

export interface RangeBarProps {
  /** The reading; null draws the scale without a marker. */
  value: number | null;
  min: number;
  max: number;
  /** The supportive stretch of the scale, shaded. */
  zone?: readonly [number, number];
  tone?: RangeTone;
  ticks?: readonly number[];
  /** Draws a heavier line where the scale crosses zero (or any reference value). */
  zero?: number;
  width?: number;
  height?: number;
  /** Spoken description: the visual alone is not enough for assistive technology. */
  label: string;
}

export interface RangeBarModel {
  width: number;
  height: number;
  track: { x1: number; x2: number; y: number };
  zone?: { x: number; y: number; width: number; height: number };
  ticks: { x: number; y1: number; y2: number }[];
  zero?: { x: number; y1: number; y2: number };
  mark?: { x: number; y: number; width: number; height: number };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Geometry of a range bar, as the prototype's svgkit.rangebar draws it. A value outside the scale sits on its end. */
export function rangeBarModel({
  value,
  min,
  max,
  zone,
  ticks = [],
  zero,
  width = 92,
  height = 18,
}: Omit<RangeBarProps, 'label' | 'tone'>): RangeBarModel {
  const x = (v: number) =>
    round1(((Math.min(Math.max(v, min), max) - min) / (max - min)) * (width - 8) + 4);
  const cy = height / 2;
  return {
    width,
    height,
    track: { x1: 4, x2: width - 4, y: cy },
    zone: zone
      ? { x: x(zone[0]), y: cy - 5, width: round1(x(zone[1]) - x(zone[0])), height: 10 }
      : undefined,
    ticks: ticks.map((t) => ({ x: x(t), y1: cy - 3, y2: cy + 3 })),
    zero: zero === undefined ? undefined : { x: x(zero), y1: 1, y2: height - 1 },
    mark:
      value === null
        ? undefined
        : { x: round1(x(value) - 1.5), y: 1, width: 3, height: height - 2 },
  };
}

/** Where a signal sits on its scale. The shaded stretch is the supportive zone; the marker turns teal inside a clearly good reading and crimson when it is clearly adverse. */
export function RangeBar({ tone = 'neutral', label, ...scale }: RangeBarProps) {
  const model = rangeBarModel(scale);
  const markFill = tone === 'good' ? colors.teal : tone === 'bad' ? colors.crimson : colors.ink;
  return (
    <View
      role="img"
      aria-label={label}
      accessibilityLabel={label}
      accessible
      style={{ width: model.width, height: model.height }}
    >
      <Svg width={model.width} height={model.height} viewBox={`0 0 ${model.width} ${model.height}`}>
        <Line
          x1={model.track.x1}
          x2={model.track.x2}
          y1={model.track.y}
          y2={model.track.y}
          stroke={colors.rule}
          strokeWidth={1}
        />
        {model.zone ? (
          <Rect
            x={model.zone.x}
            y={model.zone.y}
            width={model.zone.width}
            height={model.zone.height}
            rx={1}
            fill={colors.tealBg}
          />
        ) : null}
        {model.ticks.map((tick) => (
          <Line
            key={tick.x}
            x1={tick.x}
            x2={tick.x}
            y1={tick.y1}
            y2={tick.y2}
            stroke={colors.ink3}
            strokeWidth={1}
          />
        ))}
        {model.zero ? (
          <Line
            x1={model.zero.x}
            x2={model.zero.x}
            y1={model.zero.y1}
            y2={model.zero.y2}
            stroke={colors.ink2}
            strokeWidth={1}
          />
        ) : null}
        {model.mark ? (
          <Rect
            x={model.mark.x}
            y={model.mark.y}
            width={model.mark.width}
            height={model.mark.height}
            rx={1}
            fill={markFill}
          />
        ) : null}
      </Svg>
    </View>
  );
}
