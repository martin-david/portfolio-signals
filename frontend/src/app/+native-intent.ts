/**
 * The identity provider sends people back to portfoliosignals://auth/callback. expo-auth-session reads that result
 * itself, so the link must not also navigate the app to a screen.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.includes('auth/callback') ? '/' : path;
}
