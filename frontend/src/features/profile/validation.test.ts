import { hasErrors, isUnchanged, trimmed, validateProfile } from './validation';

describe('validateProfile', () => {
  const valid = { displayName: 'Ada Byron', email: 'ada@example.test' };

  it('accepts a name and an address', () => {
    const errors = validateProfile(valid);
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it('asks for what is missing, treating spaces as nothing', () => {
    expect(validateProfile({ displayName: '  ', email: '' })).toEqual({
      displayName: 'Enter the name to show for your account.',
      email: 'Enter your e-mail address.',
    });
  });

  it.each(['no-at-sign', 'two@@example.test', 'a b@example.test', 'ada@nodot', '@example.test'])(
    'rejects the address %j',
    (email) => {
      expect(validateProfile({ ...valid, email }).email).toMatch(/^Enter an e-mail address/);
    },
  );

  it('applies the API limits to the length of each field', () => {
    expect(validateProfile({ ...valid, displayName: 'x'.repeat(101) }).displayName).toBe(
      'Use at most 100 characters.',
    );
    expect(validateProfile({ ...valid, displayName: 'x'.repeat(100) }).displayName).toBeUndefined();
    const long = `${'x'.repeat(320)}@example.test`;
    expect(validateProfile({ ...valid, email: long }).email).toBe('Use at most 320 characters.');
  });

  it('judges the trimmed values, which are also what is sent', () => {
    expect(validateProfile({ displayName: '  Ada  ', email: ' ada@example.test ' })).toEqual({});
    expect(trimmed({ displayName: '  Ada  ', email: ' ada@example.test ' })).toEqual({
      displayName: 'Ada',
      email: 'ada@example.test',
    });
  });

  it('knows when nothing was changed', () => {
    expect(isUnchanged(valid, { displayName: ' Ada Byron', email: 'ada@example.test ' })).toBe(
      true,
    );
    expect(isUnchanged(valid, { ...valid, displayName: 'Ada B.' })).toBe(false);
  });
});
