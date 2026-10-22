import { Icon as PaperIcon } from 'react-native-paper';

export interface IconProps {
  /** A MaterialCommunityIcons name. */
  name: string;
  size?: number;
  color: string;
}

/** A decorative icon: assistive technology skips it, so whatever it sits beside must carry the meaning in words. */
export function Icon({ name, size = 24, color }: IconProps) {
  return <PaperIcon source={name} size={size} color={color} />;
}
