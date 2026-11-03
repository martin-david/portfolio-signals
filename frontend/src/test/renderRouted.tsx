import { usePathname } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType, ReactNode } from 'react';
import { Text } from 'react-native';

import type { MockScenario } from '@/config/env';
import { useRefreshWhenSyncCompletes } from '@/features/sync/hooks';
import { ToastProvider } from '@/ui';

import { createTestApi, registerTestUser, type Intercept } from './apiTestUtils';
import { Providers } from './renderUi';

/** Shows where the app went, so that a test can follow a link without rendering the screen behind it. */
function RouteStub() {
  return <Text testID="route-stub">{`Route: ${usePathname()}`}</Text>;
}

const OTHER_SCREENS = [
  'holdings/index',
  'holdings/[symbol]',
  'insights',
  'connections',
  'settings',
  'method',
];

/** The app frame mounts this once; screens rely on it to refresh what a finished sync changed. */
function SyncRefresh() {
  useRefreshWhenSyncCompletes();
  return null;
}

export interface RoutedOptions {
  scenario?: MockScenario;
  initialUrl?: string;
  intercept?: Intercept;
}

/**
 * Renders one screen at "/" inside a real router, over the demo backend, with the providers the app has. Every other
 * screen of the app is a stub that says its path, so links can be followed and checked. The `empty` scenario starts
 * without a registered user, which a screen test has no use for, so the user is registered first.
 */
export async function renderRouted(Screen: ComponentType, options: RoutedOptions = {}) {
  const scenario = options.scenario ?? 'happy';
  const api = createTestApi(scenario, { intercept: options.intercept });
  if (scenario === 'empty') {
    await registerTestUser(api.backend);
  }
  const Api = api.wrapper;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Providers>
        <Api>
          <ToastProvider>
            <SyncRefresh />
            {children}
          </ToastProvider>
        </Api>
      </Providers>
    );
  }

  const routes: Record<string, ComponentType> = { index: Screen };
  for (const name of OTHER_SCREENS) {
    routes[name] = RouteStub;
  }
  const app = await renderRouter(routes, {
    initialUrl: options.initialUrl ?? '/',
    wrapper: Wrapper,
  });
  return { app, ...api };
}
