import { contrastRatio } from '@/lib/contrast';

import { colors, toneColor, verdictChip, verdictFill } from './tokens';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow('Expected #rrggbb');
  });
});

describe('design tokens meet WCAG AA', () => {
  const grounds = { paper: colors.paper, sheet: colors.sheet, sheetSunken: colors.sheetSunken };

  it.each(
    Object.entries(grounds).flatMap(([ground, background]) =>
      (['ink', 'muted', 'subtle', 'link', 'positive', 'warning', 'danger'] as const).map(
        (tone) => [tone, ground, toneColor[tone], background] as const,
      ),
    ),
  )('%s text on %s is at least 4.5:1', (_tone, _ground, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(verdictFill))('white text on the %s strip fill', (_name, fill) => {
    expect(contrastRatio(fill.text, fill.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(verdictChip))('the %s chip text on its background', (_name, chip) => {
    expect(contrastRatio(chip.text, chip.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps secondary text readable on the slate backgrounds', () => {
    expect(contrastRatio(colors.ink2, colors.slateBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.ink, colors.slateBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('draws control boundaries at 3:1 against the sheet', () => {
    expect(contrastRatio(colors.controlBorder, colors.sheet)).toBeGreaterThanOrEqual(3);
  });

  it('keeps the two series colours of the charts distinguishable and legible on the sheet', () => {
    expect(contrastRatio(colors.blue, colors.sheet)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.orange, colors.sheet)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps white on the dark ink fill of primary buttons', () => {
    expect(contrastRatio(colors.white, colors.ink)).toBeGreaterThanOrEqual(7);
  });
});
