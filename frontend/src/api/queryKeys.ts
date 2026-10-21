export const queryKeys = {
  me: ['me'] as const,
  integrations: ['integrations'] as const,
  syncRunsAll: ['sync', 'runs'] as const,
  syncRuns: (take: number) => ['sync', 'runs', take] as const,
  /** Prefix of everything derived from the synchronized portfolio. */
  portfolioAll: ['portfolio'] as const,
  portfolio: ['portfolio', 'latest'] as const,
  analysis: ['portfolio', 'analysis'] as const,
  snapshots: (take: number) => ['portfolio', 'snapshots', take] as const,
  holding: (symbol: string) => ['portfolio', 'holding', symbol.toUpperCase()] as const,
};
