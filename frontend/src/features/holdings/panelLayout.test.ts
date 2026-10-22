import {
  PANEL_COLUMNS,
  PANEL_PADDING,
  SIGNAL_COLUMNS,
  TABLE_MIN_WIDTH,
  contentWidthFor,
  panelMode,
  showsPnlColumn,
} from './panelLayout';

describe('contentWidthFor', () => {
  it('is the window inside the gutters, up to the maximum content width', () => {
    expect(contentWidthFor(1000)).toBe(920);
    expect(contentWidthFor(1280)).toBe(1200);
    expect(contentWidthFor(1920)).toBe(1200);
    expect(contentWidthFor(700)).toBe(652);
    expect(contentWidthFor(390)).toBe(358);
  });
});

describe('panelMode', () => {
  it('needs every column at its width and the padding of the row', () => {
    const columns =
      PANEL_COLUMNS.holding +
      PANEL_COLUMNS.verdict +
      PANEL_COLUMNS.score +
      PANEL_COLUMNS.signal * SIGNAL_COLUMNS +
      PANEL_COLUMNS.pnl;

    expect(TABLE_MIN_WIDTH).toBe(columns + PANEL_PADDING * 2);
  });

  it('shows the bars on a window wide enough for the table to fit, and words on any other', () => {
    const narrowest = TABLE_MIN_WIDTH + 80;

    expect(panelMode(1920)).toBe('table');
    expect(panelMode(1280)).toBe('table');
    expect(panelMode(narrowest)).toBe('table');
    expect(panelMode(narrowest - 1)).toBe('list');
    expect(panelMode(1024)).toBe('list');
    expect(panelMode(820)).toBe('list');
    expect(panelMode(390)).toBe('list');
  });
});

describe('showsPnlColumn', () => {
  it('moves the result into the details on a phone', () => {
    expect(showsPnlColumn(600)).toBe(true);
    expect(showsPnlColumn(599)).toBe(false);
    expect(showsPnlColumn(390)).toBe(false);
    expect(showsPnlColumn(1280)).toBe(true);
  });
});
