import type { IntegrationProvider } from '@/api/schema';

/** The API's limit for one credential value (the backend and the demo both enforce it). */
export const MAX_CREDENTIAL_LENGTH = 2048;

const KNOWN_LABELS: Record<string, string> = {
  apiKey: 'API key',
  userKey: 'User key',
};

/** "apiKey" -> "API key": the API names fields in camelCase, people read words. */
export function credentialLabel(field: string): string {
  const known = KNOWN_LABELS[field];
  if (known) {
    return known;
  }
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field;
}

export type CredentialValues = Readonly<Record<string, string>>;
export type CredentialErrors = Record<string, string>;

/** Checks what the API checks, so most mistakes are caught before a request is made. */
export function validateCredentials(
  fields: readonly string[],
  values: CredentialValues,
): CredentialErrors {
  const errors: CredentialErrors = {};
  for (const field of fields) {
    const value = (values[field] ?? '').trim();
    if (!value) {
      errors[field] = `${credentialLabel(field)} is required.`;
    } else if (value.length > MAX_CREDENTIAL_LENGTH) {
      errors[field] = `Use at most ${MAX_CREDENTIAL_LENGTH} characters.`;
    }
  }
  return errors;
}

/** What is sent: exactly the fields the provider asks for, without the spaces a paste tends to bring along. */
export function credentialsToSend(
  fields: readonly string[],
  values: CredentialValues,
): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, (values[field] ?? '').trim()]));
}

/** What each provider is used for, in the words the connections screen uses. */
export function providerRole(provider: IntegrationProvider): string {
  return provider === 'Etoro'
    ? 'Your holdings, what you paid for them and your cash.'
    : 'Analyst ratings, price targets and scores for each stock you hold.';
}
