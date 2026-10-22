import { gutterFor, breakpointFor, layout } from '@/ui';

/** Bars give way to text when the signal columns would not fit. */
export type PanelMode = 'table' | 'list';

/**
 * Widths of the instrument-panel columns, in dp. The holding column takes whatever is left; the others keep their
 * width so that the header lines up with every row.
 */
export const PANEL_COLUMNS = {
  holding: 200,
  verdict: 124,
  score: 68,
  signal: 100,
  pnl: 92,
} as const;

/** Inner padding of a row, either side. */
export const PANEL_PADDING = 16;

export const SIGNAL_COLUMNS = 6;

/** What the table needs: every column at its width, plus the row's own padding. */
export const TABLE_MIN_WIDTH =
  PANEL_COLUMNS.holding +
  PANEL_COLUMNS.verdict +
  PANEL_COLUMNS.score +
  PANEL_COLUMNS.signal * SIGNAL_COLUMNS +
  PANEL_COLUMNS.pnl +
  PANEL_PADDING * 2;

/** The width the page gives its content: the window up to the maximum, inside the gutters. */
export function contentWidthFor(windowWidth: number): number {
  return Math.min(windowWidth, layout.maxContentWidth) - 2 * gutterFor(breakpointFor(windowWidth));
}

/**
 * The full instrument panel (six range bars per holding) when it fits without scrolling sideways, else one line per
 * holding with the signals in words inside its details.
 */
export function panelMode(windowWidth: number): PanelMode {
  return contentWidthFor(windowWidth) >= TABLE_MIN_WIDTH ? 'table' : 'list';
}

/** The result against cost is a column of its own from the medium layout up; on a phone it moves into the details. */
export function showsPnlColumn(windowWidth: number): boolean {
  return windowWidth >= layout.compactBelow;
}
