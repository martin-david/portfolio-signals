import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** The width a view was given, once it has been laid out (zero before). Charts draw to this width. */
export function useMeasuredWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);
  return [width, onLayout];
}
