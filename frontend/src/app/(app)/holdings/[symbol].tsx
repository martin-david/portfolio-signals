import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/shell/PlaceholderScreen';

export default function HoldingDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  return <PlaceholderScreen title={symbol ?? 'Holding'} summary="One position in detail." />;
}
