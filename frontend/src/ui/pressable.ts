import type { PressableStateCallbackType } from 'react-native';

/** react-native-web reports hover on Pressable; the native types do not know about it. */
export function isHovered(state: PressableStateCallbackType): boolean {
  return Boolean((state as { hovered?: boolean }).hovered);
}

/** The same for keyboard focus, so a focused control can be drawn as clearly as a hovered one. */
export function isFocused(state: PressableStateCallbackType): boolean {
  return Boolean((state as { focused?: boolean }).focused);
}
