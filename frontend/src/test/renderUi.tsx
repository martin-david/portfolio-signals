import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferencesProvider } from '@/lib/preferences';
import { paperTheme } from '@/ui/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <PaperProvider theme={paperTheme}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

/** Renders with the theme, safe-area and preferences providers every screen has. */
export function renderUi(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Providers, ...options });
}
