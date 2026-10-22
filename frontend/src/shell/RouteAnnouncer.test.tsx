import { usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { RouteAnnouncer } from './RouteAnnouncer';

jest.mock('expo-router', () => ({ usePathname: jest.fn() }));

const usePathnameMock = jest.mocked(usePathname);

function setTitle(title: string) {
  (globalThis as { document?: unknown }).document = { title };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { document?: unknown }).document;
});

describe('RouteAnnouncer', () => {
  it('says nothing when the first screen appears, since a page load announces itself', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    usePathnameMock.mockReturnValue('/');
    setTitle('Overview · Portfolio Signals');

    await render(<RouteAnnouncer />);

    expect(screen.getByTestId('route-announcer')).toHaveTextContent(/^$/);
  });

  it('reads out the title of the screen a link has led to, politely', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    usePathnameMock.mockReturnValue('/');
    setTitle('Overview · Portfolio Signals');
    const { rerender } = await render(<RouteAnnouncer />);

    usePathnameMock.mockReturnValue('/insights');
    setTitle('Insights · Portfolio Signals');
    await rerender(<RouteAnnouncer />);

    await waitFor(() =>
      expect(screen.getByTestId('route-announcer')).toHaveTextContent(
        'Insights · Portfolio Signals',
      ),
    );
    expect(screen.getByTestId('route-announcer').props['aria-live']).toBe('polite');
  });

  it('is not there on a phone, where the screen reader follows the screens itself', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    usePathnameMock.mockReturnValue('/');

    await render(<RouteAnnouncer />);

    expect(screen.queryByTestId('route-announcer', { includeHiddenElements: true })).toBeNull();
  });
});
