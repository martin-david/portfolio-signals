import { useLocalSearchParams } from 'expo-router';

import { HoldingScreen } from '@/features/holdings/HoldingScreen';

export default function HoldingRoute() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  return <HoldingScreen symbol={symbol ?? ''} />;
}
