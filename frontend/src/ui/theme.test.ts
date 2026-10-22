import { paperTheme, themeFor } from './theme';

describe('themeFor', () => {
  it('is the product theme as it is when the system has no wish about motion', () => {
    expect(themeFor(false)).toBe(paperTheme);
    expect(paperTheme.animation.scale).toBe(1);
  });

  it('turns Paper\u2019s own animations off when the system asks for less motion', () => {
    const theme = themeFor(true);

    expect(theme.animation.scale).toBe(0);
    expect(theme.colors).toBe(paperTheme.colors);
    expect(theme.fonts).toBe(paperTheme.fonts);
  });

  it('leaves the product theme itself untouched', () => {
    themeFor(true);

    expect(paperTheme.animation.scale).toBe(1);
  });
});
