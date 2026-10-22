import { View } from 'react-native';
import { Icon as PaperIcon } from 'react-native-paper';

export interface IconProps {
  /** A MaterialCommunityIcons name. */
  name: string;
  size?: number;
  color: string;
  testID?: string;
}

/**
 * A decorative icon: assistive technology skips it, so whatever it sits beside must carry the meaning in words. Paper
 * hides it on Android and iOS but not on the web, where it would be an unnamed image, hence the wrapper.
 */
export function Icon({ name, size = 24, color, testID }: IconProps) {
  return (
    <View aria-hidden testID={testID}>
      <PaperIcon source={name} size={size} color={color} />
    </View>
  );
}
