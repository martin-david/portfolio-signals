import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describeError, firstFieldError } from '@/api/errors';
import type { IntegrationDto } from '@/api/schema';
import { Button, Heading, Notice, Text, TextField, space } from '@/ui';

import {
  credentialLabel,
  credentialsToSend,
  validateCredentials,
  type CredentialValues,
} from './credentials';
import { providerLabel } from './freshness';
import { useConnectProvider } from './hooks';

export interface ConnectFormProps {
  integration: IntegrationDto;
  onConnected: () => void;
  onCancel: () => void;
}

function headingFor(integration: IntegrationDto): { title: string; submit: string } {
  const name = providerLabel(integration.provider);
  switch (integration.status) {
    case 'Active':
      return { title: `Replace the ${name} credentials`, submit: 'Save credentials' };
    case 'CredentialsRejected':
      return { title: `Reconnect ${name}`, submit: 'Reconnect' };
    default:
      return { title: `Connect ${name}`, submit: 'Connect' };
  }
}

/**
 * Asks for the credentials a provider needs, as the API lists them. They are write-only: typed here, sent once, never
 * shown again, and dropped from memory as soon as the API has accepted them.
 */
export function ConnectForm({ integration, onConnected, onCancel }: ConnectFormProps) {
  const fields = integration.requiredCredentialFields;
  const [values, setValues] = useState<CredentialValues>({});
  const [attempted, setAttempted] = useState(false);
  const connect = useConnectProvider();
  const { title, submit: submitLabel } = headingFor(integration);

  const clientErrors = attempted ? validateCredentials(fields, values) : {};
  const apiMessage = firstFieldError(connect.error, 'credentials');

  function change(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (connect.isError) {
      connect.reset();
    }
  }

  function submit() {
    setAttempted(true);
    if (Object.keys(validateCredentials(fields, values)).length > 0) {
      return;
    }
    connect.mutate(
      { provider: integration.provider, credentials: credentialsToSend(fields, values) },
      {
        onSuccess: () => {
          setValues({});
          connect.reset();
          onConnected();
        },
      },
    );
  }

  return (
    <View style={styles.form} testID={`connect-form-${integration.provider}`}>
      <Heading level={3}>{title}</Heading>
      <Text variant="small" tone="muted">
        {`Use your own ${providerLabel(integration.provider)} keys. They are write-only: the app sends them once and never shows them again.`}
      </Text>
      {connect.isError ? (
        <Notice tone="danger" title="Couldn't save the credentials">
          {apiMessage ?? describeError(connect.error)}
        </Notice>
      ) : null}
      {fields.map((field, index) => (
        <TextField
          key={field}
          label={credentialLabel(field)}
          value={values[field] ?? ''}
          onChangeText={(value) => change(field, value)}
          error={clientErrors[field]}
          secret
          autoFocus={index === 0}
          disabled={connect.isPending}
          onSubmitEditing={index === fields.length - 1 ? submit : undefined}
          testID={`credential-${integration.provider}-${field}`}
        />
      ))}
      <View style={styles.actions}>
        <Button
          onPress={submit}
          loading={connect.isPending}
          testID={`connect-submit-${integration.provider}`}
        >
          {submitLabel}
        </Button>
        <Button variant="quiet" onPress={onCancel} disabled={connect.isPending}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
