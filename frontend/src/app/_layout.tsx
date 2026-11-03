import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { ApiProvider } from '@/api/ApiProvider';
import { AuthProvider } from '@/auth';
import { createAppServices } from '@/bootstrap';
import { loadConfig, type AppConfig } from '@/config/env';
import { PreferencesProvider } from '@/lib/preferences';
import { AppNavigator } from '@/shell/AppNavigator';
import { ConfigErrorScreen } from '@/shell/ConfigErrorScreen';
import { PlainFrame } from '@/shell/PlainFrame';
import {
  ToastProvider,
  installFocusRing,
  paperTheme,
  themeFor,
  useAppFonts,
  useReducedMotion,
} from '@/ui';

// Keep the native splash screen up until the session is known; the web has none.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function useWebDocument() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.lang = 'en';
      installFocusRing();
    }
  }, []);
}

function ConfiguredApp({ config }: { config: AppConfig }) {
  const [services] = useState(() => createAppServices(config));
  const fontsReady = useAppFonts();
  const reducedMotion = useReducedMotion();
  const theme = useMemo(() => themeFor(reducedMotion), [reducedMotion]);
  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <PaperProvider theme={theme}>
      <PreferencesProvider>
        <AuthProvider controller={services.auth}>
          <ApiProvider
            config={config}
            auth={services.auth.hooks}
            queryClient={services.queryClient}
          >
            <ToastProvider>
              <AppNavigator fontsReady={fontsReady} onReady={hideSplash} />
            </ToastProvider>
          </ApiProvider>
        </AuthProvider>
      </PreferencesProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  useWebDocument();
  const result = loadConfig();
  if (!result.ok) {
    return (
      <PaperProvider theme={paperTheme}>
        <PlainFrame>
          <ConfigErrorScreen errors={result.errors} />
        </PlainFrame>
      </PaperProvider>
    );
  }
  return <ConfiguredApp config={result.config} />;
}
