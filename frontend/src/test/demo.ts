import type { IntegrationDto, PortfolioAnalysisDto, PortfolioDto, SyncRunDto } from '@/api/schema';
import type { MockScenario } from '@/config/env';
import { createMockBackend } from '@/mocks/mockBackend';

export interface Demo {
  analysis: PortfolioAnalysisDto;
  portfolio: PortfolioDto;
  integrations: IntegrationDto[];
  runs: SyncRunDto[];
}

/** The scored demo portfolio and its sync state, as the API serves it. */
export async function loadDemo(scenario: MockScenario = 'happy'): Promise<Demo> {
  const backend = createMockBackend({ scenario });
  const get = async <T>(path: string): Promise<T> => {
    const response = await backend.fetch(
      new Request(`https://mock.invalid/api/v1${path}`, { headers: { 'X-Dev-User': 'tester' } }),
    );
    return (await response.json()) as T;
  };
  return {
    analysis: await get<PortfolioAnalysisDto>('/portfolio/analysis'),
    portfolio: await get<PortfolioDto>('/portfolio'),
    integrations: await get<IntegrationDto[]>('/integrations'),
    runs: await get<SyncRunDto[]>('/sync/runs'),
  };
}
