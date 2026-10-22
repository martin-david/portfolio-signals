import { useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput as PaperTextInput } from 'react-native-paper';

import { colors, fonts, space } from './tokens';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Validation message; also marks the field invalid. */
  error?: string;
  hint?: string;
  /** A secret such as an API key: masked, never autofilled or remembered by the keyboard, with a show toggle. */
  secret?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  disabled?: boolean;
  /** Moves focus here when the field appears, for forms that open on request. */
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  secret = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  disabled = false,
  autoFocus = false,
  onSubmitEditing,
  testID,
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const message = error ?? hint;
  return (
    <View>
      <PaperTextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        error={Boolean(error)}
        disabled={disabled}
        outlineColor={colors.controlBorder}
        activeOutlineColor={colors.ink}
        style={{ backgroundColor: colors.sheet, fontFamily: fonts.ui }}
        outlineStyle={{ borderRadius: 4 }}
        accessibilityLabel={label}
        keyboardType={keyboardType}
        autoCapitalize={secret ? 'none' : autoCapitalize}
        autoCorrect={false}
        spellCheck={false}
        autoFocus={autoFocus}
        autoComplete={secret ? 'off' : undefined}
        importantForAutofill={secret ? 'no' : 'auto'}
        secureTextEntry={secret && !revealed}
        right={
          secret ? (
            <PaperTextInput.Icon
              icon={revealed ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setRevealed((shown) => !shown)}
              accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
            />
          ) : undefined
        }
        onSubmitEditing={onSubmitEditing}
        testID={testID}
      />
      {message ? (
        <HelperText
          type={error ? 'error' : 'info'}
          visible
          style={{ paddingHorizontal: space.xs, color: error ? colors.crimson : colors.ink3 }}
        >
          {message}
        </HelperText>
      ) : null}
    </View>
  );
}
