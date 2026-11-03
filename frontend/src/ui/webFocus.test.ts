import { Platform } from 'react-native';

import { contrastRatio } from '@/lib/contrast';

import { colors } from './tokens';
import { focusRingCss, installFocusRing } from './webFocus';

interface FakeElement {
  id?: string;
  textContent?: string;
}

/** Just enough of a page to see what is added to it. */
function fakeDocument() {
  const byId = new Map<string, FakeElement>();
  const appended: FakeElement[] = [];
  const page = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (): FakeElement => ({}),
    head: {
      appendChild: (element: FakeElement) => {
        appended.push(element);
        if (element.id) {
          byId.set(element.id, element);
        }
      },
    },
  };
  (globalThis as { document?: unknown }).document = page;
  return appended;
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { document?: unknown }).document;
});

describe('focusRingCss', () => {
  it('draws the ring in the product blue, set off from the control, for keyboard focus only', () => {
    const css = focusRingCss();

    expect(css).toContain(':focus-visible');
    expect(css).toContain(`outline: 3px solid ${colors.blue}`);
    expect(css).toContain('outline-offset: 2px');
    // A plain :focus rule would draw the ring on every mouse click as well.
    expect(css).not.toMatch(/:focus\s*\{/);
  });

  it('leaves text fields, which draw their own focus border, and programmatic focus targets alone', () => {
    const css = focusRingCss();

    expect(css).toMatch(
      /input:focus-visible, textarea:focus-visible, \[tabindex="-1"\]:focus-visible/,
    );
  });

  it('stands out from the white and the paper it is drawn against', () => {
    expect(contrastRatio(colors.blue, colors.sheet)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.blue, colors.paper)).toBeGreaterThanOrEqual(3);
  });
});

describe('installFocusRing', () => {
  it('adds one stylesheet to the page, however often it is asked to', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const appended = fakeDocument();

    installFocusRing();
    installFocusRing();

    expect(appended).toHaveLength(1);
    expect(appended[0].textContent).toBe(focusRingCss());
  });

  it('does nothing away from the web', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const appended = fakeDocument();

    installFocusRing();

    expect(appended).toHaveLength(0);
  });
});
