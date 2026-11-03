import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/ApiProvider';
import { ProblemCode } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { nullWhen, unwrap } from '@/api/request';

/** The signed-in user's profile, or null when they have not registered yet. */
export function useMe({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) =>
      nullWhen(unwrap(client.GET('/api/v1/me', { signal })), ProblemCode.UserNotRegistered),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useUpsertProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: { displayName: string; email: string }) =>
      unwrap(client.PUT('/api/v1/me', { body: profile })),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.me, profile);
    },
  });
}
