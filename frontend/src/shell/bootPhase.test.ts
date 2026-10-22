import { bootPhase, type BootInput } from './bootPhase';

const settled: BootInput = {
  fontsReady: true,
  preferencesReady: true,
  authStatus: 'signedIn',
  profile: { data: { displayName: 'Ada' }, isError: false, isFetching: false },
};

const phase = (overrides: Partial<BootInput> = {}, profile: Partial<BootInput['profile']> = {}) =>
  bootPhase({ ...settled, ...overrides, profile: { ...settled.profile, ...profile } });

describe('bootPhase', () => {
  it('waits for the fonts, the stored preferences and the stored session before it shows anything', () => {
    expect(phase({ fontsReady: false })).toBe('booting');
    expect(phase({ preferencesReady: false })).toBe('booting');
    expect(phase({ authStatus: 'restoring' })).toBe('booting');
  });

  it('sends a person with no session to sign in, whatever the profile query says', () => {
    expect(phase({ authStatus: 'signedOut' }, { data: undefined })).toBe('signed-out');
    expect(phase({ authStatus: 'signedOut' }, { data: { displayName: 'Ada' } })).toBe('signed-out');
  });

  it('opens the account while the profile is on its way', () => {
    expect(phase({}, { data: undefined, isFetching: true })).toBe('opening-account');
    expect(phase({}, { data: undefined })).toBe('opening-account');
  });

  it('asks a person the API does not know yet for their details', () => {
    expect(phase({}, { data: null })).toBe('needs-profile');
  });

  it('opens the app for a known person', () => {
    expect(phase()).toBe('ready');
  });

  it('reports a profile that could not be read, but only once it has stopped trying', () => {
    expect(phase({}, { data: undefined, isError: true })).toBe('account-error');
    expect(phase({}, { data: undefined, isError: true, isFetching: true })).toBe('opening-account');
  });

  it('keeps a person in the app when a refresh of the profile they already have fails', () => {
    expect(phase({}, { isError: true })).toBe('ready');
    expect(phase({}, { data: null, isError: true })).toBe('needs-profile');
  });
});
