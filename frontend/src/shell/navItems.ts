export interface NavItem {
  key: string;
  label: string;
  /** Where the destination lives. Also what the active item is matched against. */
  href: '/' | '/holdings' | '/insights' | '/connections' | '/settings' | '/method';
  /** MaterialCommunityIcons names: outline when idle, filled when current. */
  icon: string;
  activeIcon: string;
}

/** The five destinations of the bottom bar, and of the top bar on wide screens. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/',
    icon: 'view-dashboard-outline',
    activeIcon: 'view-dashboard',
  },
  {
    key: 'holdings',
    label: 'Holdings',
    href: '/holdings',
    icon: 'format-list-bulleted',
    activeIcon: 'format-list-bulleted',
  },
  {
    key: 'insights',
    label: 'Insights',
    href: '/insights',
    icon: 'chart-box-outline',
    activeIcon: 'chart-box',
  },
  {
    key: 'connections',
    label: 'Connections',
    href: '/connections',
    icon: 'link-variant',
    activeIcon: 'link-variant',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'cog-outline',
    activeIcon: 'cog',
  },
];

/** Reference material: in the top bar on wide screens, reached from the screens it explains elsewhere. */
export const METHOD_ITEM: NavItem = {
  key: 'method',
  label: 'Method',
  href: '/method',
  icon: 'book-open-variant-outline',
  activeIcon: 'book-open-variant',
};

/** A destination is current for its own path and for everything beneath it, so a holding keeps Holdings lit. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
