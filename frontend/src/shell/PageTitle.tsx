import Head from 'expo-router/head';
import { Platform } from 'react-native';

export const APP_NAME = 'Portfolio Signals';

/** The page title on the web, so every screen has its own name in the tab, the history and a screen reader. */
export function PageTitle({ title }: { title?: string }) {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <Head>
      <title>{title ? `${title} · ${APP_NAME}` : APP_NAME}</title>
    </Head>
  );
}
