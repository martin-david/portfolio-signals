import { act, renderHook } from '@testing-library/react-native';

import { useNow } from './useNow';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useNow', () => {
  it('starts at the current time and moves on at the interval', async () => {
    const { result } = await renderHook(() => useNow(60_000));
    expect(result.current.toISOString()).toBe('2026-10-21T12:00:00.000Z');

    await act(async () => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current.toISOString()).toBe('2026-10-21T12:00:00.000Z');

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.toISOString()).toBe('2026-10-21T12:01:00.000Z');
  });

  it('stops its timer when the screen goes away', async () => {
    const started = jest.spyOn(globalThis, 'setInterval');
    const stopped = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderHook(() => useNow(1_000));
    const call = started.mock.calls.findIndex(([, delay]) => delay === 1_000);
    expect(call).toBeGreaterThanOrEqual(0);
    const timer = started.mock.results[call].value;

    await unmount();

    expect(stopped).toHaveBeenCalledWith(timer);
  });
});
