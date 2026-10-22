import type { IntegrationDto, IntegrationProvider, SyncRunDto } from '@/api/schema';
import { providerLabel } from '@/features/integrations/freshness';
import { isActiveRun } from '@/features/sync/runs';
import { describeInterval } from '@/lib/format';

export type StepState = 'done' | 'todo' | 'attention' | 'working' | 'waiting';

export interface ChecklistAction {
  label: string;
  /** Connect steps lead to the Connections screen; the sync step starts a sync right here. */
  to: 'connections' | 'sync';
}

export interface ChecklistStep {
  key: 'etoro' | 'tipranks' | 'sync';
  title: string;
  detail: string;
  state: StepState;
  action?: ChecklistAction;
}

function connectStep(
  provider: IntegrationProvider,
  integration: IntegrationDto | undefined,
): ChecklistStep {
  const name = providerLabel(provider);
  const key = provider === 'Etoro' ? 'etoro' : 'tipranks';
  const status = integration?.status ?? null;

  if (status === 'Active') {
    return {
      key,
      title: `${name} is connected`,
      detail:
        provider === 'Etoro'
          ? 'Your holdings and balances come from eToro.'
          : 'Analyst signals for your holdings come from TipRanks.',
      state: 'done',
    };
  }
  if (status === 'CredentialsRejected') {
    return {
      key,
      title: `Reconnect ${name}`,
      detail: `${name} rejected your credentials, so syncing is paused until you replace them.`,
      state: 'attention',
      action: { label: 'Reconnect', to: 'connections' },
    };
  }
  return {
    key,
    title: `Connect ${name}`,
    detail:
      provider === 'Etoro'
        ? 'Your holdings and balances come from eToro, read with your own API keys.'
        : 'Analyst signals come from TipRanks, with your own API key. Without them every holding reads No data.',
    state: 'todo',
    action: { label: `Connect ${name}`, to: 'connections' },
  };
}

/**
 * What stands between a new account and its first analysis: connect eToro, connect TipRanks, run a sync. The steps
 * are derived from the state of the connections and the sync history, so the list follows what the person has done.
 */
export function buildChecklist(
  integrations: readonly IntegrationDto[],
  runs: readonly SyncRunDto[] | undefined,
  allowsManualSync: boolean,
): ChecklistStep[] {
  const find = (provider: IntegrationProvider) =>
    integrations.find((integration) => integration.provider === provider);
  const etoro = find('Etoro');
  const etoroStep = connectStep('Etoro', etoro);
  const steps = [etoroStep, connectStep('TipRanks', find('TipRanks'))];

  if (etoroStep.state !== 'done') {
    steps.push({
      key: 'sync',
      title: 'Run the first sync',
      detail: 'Available once eToro is connected.',
      state: 'waiting',
    });
  } else if ((runs ?? []).some((run) => run.provider === 'Etoro' && isActiveRun(run))) {
    steps.push({
      key: 'sync',
      title: 'The first sync is running',
      detail: 'This page fills in by itself when it finishes.',
      state: 'working',
    });
  } else {
    const schedule = describeInterval(etoro?.syncIntervalMinutes ?? 0);
    steps.push(
      allowsManualSync
        ? {
            key: 'sync',
            title: 'Run the first sync',
            detail: `Start it now. Scheduled syncs then follow your plan, which syncs ${schedule}.`,
            state: 'todo',
            action: { label: 'Sync now', to: 'sync' },
          }
        : {
            key: 'sync',
            title: 'Wait for the first sync',
            detail: `Your plan syncs ${schedule} and does not include manual syncs, so the first one runs on that schedule.`,
            state: 'todo',
          },
    );
  }
  return steps;
}
