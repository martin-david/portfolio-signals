import { Dimensions } from 'react-native';

/**
 * Pretends the window is this wide, for layouts that depend on it. Call jest.restoreAllMocks() afterwards (the screens'
 * tests do it in afterEach).
 */
export function setWindowWidth(width: number, height = 900): void {
  jest
    .spyOn(Dimensions, 'get')
    .mockImplementation(() => ({ width, height, scale: 1, fontScale: 1 }));
}
