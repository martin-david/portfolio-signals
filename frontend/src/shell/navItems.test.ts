import { isActive, NAV_ITEMS } from './navItems';

describe('isActive', () => {
  it('lights Overview only for the root', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/holdings', '/')).toBe(false);
  });

  it('keeps a destination lit for the screens beneath it', () => {
    expect(isActive('/holdings', '/holdings')).toBe(true);
    expect(isActive('/holdings/NWND', '/holdings')).toBe(true);
    expect(isActive('/holdings/ALPSB', '/insights')).toBe(false);
  });

  it('does not confuse a path with another that starts with the same letters', () => {
    expect(isActive('/holdings-archive', '/holdings')).toBe(false);
    expect(isActive('/settings', '/set')).toBe(false);
  });

  it('has a destination for every nav item and none twice', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/',
      '/holdings',
      '/insights',
      '/connections',
      '/settings',
    ]);
    expect(new Set(NAV_ITEMS.map((item) => item.label)).size).toBe(NAV_ITEMS.length);
    const current = NAV_ITEMS.filter((item) => isActive('/connections', item.href));
    expect(current.map((item) => item.key)).toEqual(['connections']);
  });
});
