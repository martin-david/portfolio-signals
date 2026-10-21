import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { colors } from './tokens';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

interface ToastState extends ToastOptions {
  message: string;
  visible: boolean;
}

/** Transient feedback ("Sync queued") in a snackbar. Failures that need attention are shown inline instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

  const show = useCallback((message: string, options?: ToastOptions) => {
    setToast({ message, visible: true, ...options });
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <Snackbar
          visible={toast.visible}
          duration={5000}
          onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
          action={
            toast.actionLabel
              ? {
                  label: toast.actionLabel,
                  onPress: toast.onAction ?? (() => undefined),
                  textColor: colors.rule,
                }
              : undefined
          }
          wrapperStyle={styles.wrapper}
          style={styles.snackbar}
        >
          {toast.message}
        </Snackbar>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return value;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrapper: { alignItems: 'center' },
  snackbar: { backgroundColor: colors.ink, borderRadius: 4, width: '100%', maxWidth: 520 },
});
