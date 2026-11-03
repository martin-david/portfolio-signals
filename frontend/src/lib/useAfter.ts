import { useEffect, useState } from 'react';

/** False when the component appears, true once this many milliseconds have passed. For "this is taking a while". */
export function useAfter(delayMs: number): boolean {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPassed(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return passed;
}
