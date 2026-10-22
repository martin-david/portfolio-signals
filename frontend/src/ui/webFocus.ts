import { Platform } from 'react-native';

import { colors } from './tokens';

const STYLE_ID = 'portfolio-signals-focus-ring';

/**
 * The browser's own focus ring is a thin dark line that all but vanishes against the ink-coloured controls, so
 * keyboard focus gets one ring of its own everywhere: a blue outline set off from the control by a white gap, which
 * stands out on the paper, on white and beside ink alike. It shows for keyboard focus only. Text fields draw their own
 * focus border, and the main region only takes focus when "Skip to main content" sends it there.
 */
export function focusRingCss(): string {
  return `
:focus-visible { outline: 3px solid ${colors.blue}; outline-offset: 2px; box-shadow: 0 0 0 2px ${colors.sheet}; }
input:focus-visible, textarea:focus-visible, [tabindex="-1"]:focus-visible { outline: none; box-shadow: none; }
`;
}

/** Adds the focus ring to the page, once. Nothing happens off the web. */
export function installFocusRing(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = focusRingCss();
  document.head.appendChild(style);
}
