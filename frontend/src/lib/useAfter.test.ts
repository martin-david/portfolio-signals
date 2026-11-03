import { act, renderHook } from '@testing-library/react-native';

import { useAfter } from './useAfter';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useAfter', () => {
  it('is false at first and true once the delay has passed', async () => {
    const { result } = await renderHook(() => useAfter(6_000));
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(5_999);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('stays true afterwards', async () => {
    const { result } = await renderHook(() => useAfter(1_000));

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(true);
  });

  it('stops its timer when the screen goes away', async () => {
    const started = jest.spyOn(globalThis, 'setTimeout');
    const stopped = jest.spyOn(globalThis, 'clearTimeout');
    const { unmount } = await renderHook(() => useAfter(1_000));
    const call = started.mock.calls.findIndex(([, delay]) => delay === 1_000);
    expect(call).toBeGreaterThanOrEqual(0);
    const timer = started.mock.results[call].value;

    await unmount();

    expect(stopped).toHaveBeenCalledWith(timer);
  });
});
