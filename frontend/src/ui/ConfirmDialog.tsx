import { Dialog, Portal } from 'react-native-paper';

import { Button } from './Button';
import { Text } from './Text';
import { colors } from './tokens';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** For decisions that must interrupt, such as disconnecting a provider. Everything else stays inline. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={busy ? undefined : onCancel}
        style={{
          backgroundColor: colors.sheet,
          borderRadius: 4,
          maxWidth: 480,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Dialog.Title style={{ color: colors.ink }}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text tone="muted">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button variant="quiet" onPress={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
