import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { AuthMode } from '@/config/env';

import type { AuthController, AuthState } from './controller';
import type { SignInInput } from './types';

export interface AuthContextValue extends AuthState {
  mode: AuthMode;
  signIn(input?: SignInInput): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  controller,
  children,
}: {
  controller: AuthController;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  useEffect(() => {
    void controller.restore();
  }, [controller]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      mode: controller.mode,
      signIn: controller.signIn,
      signOut: controller.signOut,
    }),
    [state, controller],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
