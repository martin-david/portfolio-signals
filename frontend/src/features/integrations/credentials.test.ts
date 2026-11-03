import {
  MAX_CREDENTIAL_LENGTH,
  credentialLabel,
  credentialsToSend,
  providerRole,
  validateCredentials,
} from './credentials';

describe('credentialLabel', () => {
  it('words the fields the providers ask for', () => {
    expect(credentialLabel('apiKey')).toBe('API key');
    expect(credentialLabel('userKey')).toBe('User key');
  });

  it('turns any other camelCase or snake_case name into words', () => {
    expect(credentialLabel('clientSecret')).toBe('Client secret');
    expect(credentialLabel('access_token')).toBe('Access token');
    expect(credentialLabel('token')).toBe('Token');
    expect(credentialLabel('')).toBe('');
  });
});

describe('validateCredentials', () => {
  const fields = ['apiKey', 'userKey'];

  it('asks for each missing field by name, treating spaces as nothing', () => {
    expect(validateCredentials(fields, { apiKey: '   ' })).toEqual({
      apiKey: 'API key is required.',
      userKey: 'User key is required.',
    });
  });

  it('accepts complete credentials', () => {
    expect(validateCredentials(fields, { apiKey: 'a', userKey: 'b' })).toEqual({});
  });

  it('applies the API limit to the trimmed value', () => {
    const long = 'x'.repeat(MAX_CREDENTIAL_LENGTH + 1);
    expect(validateCredentials(['apiKey'], { apiKey: long })).toEqual({
      apiKey: 'Use at most 2048 characters.',
    });
    expect(
      validateCredentials(['apiKey'], { apiKey: ` ${'x'.repeat(MAX_CREDENTIAL_LENGTH)} ` }),
    ).toEqual({});
  });
});

describe('credentialsToSend', () => {
  it('sends exactly the requested fields, trimmed, and nothing else that was typed', () => {
    expect(
      credentialsToSend(['apiKey', 'userKey'], {
        apiKey: ' key-1 ',
        userKey: 'user-1\n',
        leftover: 'secret',
      }),
    ).toEqual({ apiKey: 'key-1', userKey: 'user-1' });
  });

  it('sends an empty string for a field that was never typed into', () => {
    expect(credentialsToSend(['apiKey'], {})).toEqual({ apiKey: '' });
  });
});

describe('providerRole', () => {
  it('says what each provider contributes', () => {
    expect(providerRole('Etoro')).toMatch(/holdings/);
    expect(providerRole('TipRanks')).toMatch(/Analyst ratings/);
  });
});
