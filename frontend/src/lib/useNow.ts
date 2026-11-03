import { useEffect, useState } from 'react';

/**
 * The current time, refreshed on an interval, for text such as "3 minutes ago" that must stay true while a screen is
 * open. Reading the clock while rendering would make a render depend on when it ran, so it lives in state.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
