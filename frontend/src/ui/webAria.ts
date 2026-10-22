import { Platform } from 'react-native';

type AriaValue = string | number | boolean | undefined;

/**
 * ARIA attributes that React Native's view types do not list (aria-sort, aria-pressed, aria-controls). react-native-web
 * passes them to the DOM; on Android there is no equivalent, so nothing is sent and the state is carried by
 * accessibilityState and the label instead.
 */
export function webAria(attributes: Record<string, AriaValue>): Record<string, AriaValue> {
  return Platform.OS === 'web' ? attributes : {};
}
