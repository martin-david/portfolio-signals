import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/api/ApiProvider';
import { ProblemCode } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { nullWhen, unwrap } from '@/api/request';

/** The latest synchronized eToro portfolio, or null before the first sync. */
export function usePortfolio() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: ({ signal }) =>
      nullWhen(unwrap(client.GET('/api/v1/portfolio', { signal })), ProblemCode.PortfolioNotSynced),
  });
}

/** Every holding scored against the latest analyst signals, or null before the first sync. */
export function useAnalysis() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.analysis,
    queryFn: ({ signal }) =>
      nullWhen(
        unwrap(client.GET('/api/v1/portfolio/analysis', { signal })),
        ProblemCode.PortfolioNotSynced,
      ),
  });
}

export function useSnapshots(take = 20) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.snapshots(take),
    queryFn: ({ signal }) =>
      unwrap(client.GET('/api/v1/portfolio/snapshots', { params: { query: { take } }, signal })),
  });
}

/** One holding with the signals behind its verdict, or null when it is not in the latest snapshot. */
export function useHolding(symbol: string, options: { enabled?: boolean } = {}) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.holding(symbol),
    queryFn: ({ signal }) =>
      nullWhen(
        unwrap(
          client.GET('/api/v1/portfolio/holdings/{symbol}', {
            params: { path: { symbol } },
            signal,
          }),
        ),
        ProblemCode.HoldingNotFound,
        ProblemCode.PortfolioNotSynced,
      ),
    enabled: options.enabled ?? true,
  });
}
