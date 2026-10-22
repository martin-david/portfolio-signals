import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describeError, firstFieldError } from '@/api/errors';
import type { UserProfileDto } from '@/api/schema';
import { Button, Notice, TextField, space } from '@/ui';

import { useUpsertProfile } from './hooks';
import { hasErrors, isUnchanged, trimmed, validateProfile, type ProfileValues } from './validation';

export interface ProfileFormProps {
  initial: ProfileValues;
  submitLabel: string;
  /** Called after the API accepted the profile, while the form is still on screen. */
  onSaved?: (profile: UserProfileDto) => void;
  /** Keeps the button off until something was edited (Settings). */
  requireChange?: boolean;
}

/** Display name and e-mail address, checked here with the API's rules and again by the API, whose messages land on the fields. */
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
  requireChange = false,
}: ProfileFormProps) {
  const [values, setValues] = useState<ProfileValues>(initial);
  const [attempted, setAttempted] = useState(false);
  const save = useUpsertProfile();

  const clientErrors = attempted ? validateProfile(values) : {};
  const serverErrors = {
    displayName: firstFieldError(save.error, 'displayName'),
    email: firstFieldError(save.error, 'email'),
  };
  const fieldsExplainTheError = Boolean(serverErrors.displayName || serverErrors.email);

  function change(patch: Partial<ProfileValues>) {
    setValues((current) => ({ ...current, ...patch }));
    if (save.isError) {
      save.reset();
    }
  }

  function submit() {
    setAttempted(true);
    if (hasErrors(validateProfile(values))) {
      return;
    }
    save.mutate(trimmed(values), { onSuccess: (profile) => onSaved?.(profile) });
  }

  return (
    <View style={styles.form}>
      {save.isError && !fieldsExplainTheError ? (
        <Notice tone="danger" title="Couldn't save your details">
          {describeError(save.error)}
        </Notice>
      ) : null}
      <TextField
        label="Display name"
        value={values.displayName}
        onChangeText={(displayName) => change({ displayName })}
        error={clientErrors.displayName ?? serverErrors.displayName}
        autoCapitalize="words"
        disabled={save.isPending}
        testID="profile-display-name"
      />
      <TextField
        label="E-mail"
        value={values.email}
        onChangeText={(email) => change({ email })}
        error={clientErrors.email ?? serverErrors.email}
        keyboardType="email-address"
        disabled={save.isPending}
        onSubmitEditing={submit}
        testID="profile-email"
      />
      <Button
        onPress={submit}
        loading={save.isPending}
        disabled={requireChange && isUnchanged(values, initial)}
        testID="profile-submit"
      >
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
