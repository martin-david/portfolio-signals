import '@testing-library/react-native/matchers';
import { timeoutManager } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Icon fonts load through native asset modules, which do not exist under Jest.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: () => null,
}));

// TanStack Query keeps a five minute garbage-collection timer for every query it has fetched. Timers that do not hold
// the process open let a test file finish as soon as its tests do.
type Unrefable = { unref?: () => void };
const unref = <T>(timer: T): T => {
  (timer as Unrefable).unref?.();
  return timer;
};
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unref(setTimeout(callback, delay)) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as Parameters<typeof clearTimeout>[0]),
  setInterval: (callback, delay) => unref(setInterval(callback, delay)) as unknown as number,
  clearInterval: (id) => clearInterval(id as unknown as Parameters<typeof clearInterval>[0]),
});
