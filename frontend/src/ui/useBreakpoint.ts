import { useWindowDimensions } from 'react-native';

import { layout } from './tokens';

export type Breakpoint = 'compact' | 'medium' | 'wide';

export function breakpointFor(width: number): Breakpoint {
  if (width < layout.compactBelow) {
    return 'compact';
  }
  return width < layout.wideFrom ? 'medium' : 'wide';
}

/** Structural responsiveness: the layout changes at these widths, type does not flow with the viewport. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointFor(width);
}

/** Horizontal page padding, matching the prototype's clamp(16px, 4vw, 40px) in three steps. */
export function gutterFor(breakpoint: Breakpoint): number {
  return breakpoint === 'compact' ? 16 : breakpoint === 'medium' ? 24 : 40;
}
