import { base64Url, makeJwt, utf8 } from '@/test/jwt';

import { decodeJwtClaims, suggestedProfileFrom } from './jwt';

const token = makeJwt;

describe('decodeJwtClaims', () => {
  it('reads the claims, including non-ASCII text', () => {
    expect(decodeJwtClaims(token({ sub: '1', name: 'Zoë Nováková' }))).toEqual({
      sub: '1',
      name: 'Zoë Nováková',
    });
  });

  it('reads tokens whose padding was dropped and that use the url-safe alphabet', () => {
    const payload = base64Url(utf8(JSON.stringify({ note: '???>>>' })));
    expect(payload).toMatch(/[-_]/);
    expect(decodeJwtClaims(`h.${payload}.s`)).toEqual({ note: '???>>>' });
  });

  it.each([
    ['one part', 'abc'],
    ['characters outside base64url', 'h.@@@.s'],
    ['a payload that is not JSON', `h.${base64Url(utf8('nope'))}.s`],
    ['a payload that is not an object', `h.${base64Url(utf8('[1]'))}.s`],
    ['a payload that is not UTF-8', `h.${base64Url([0xff, 0xfe])}.s`],
  ])('gives up on %s', (_name, value) => {
    expect(decodeJwtClaims(value)).toBeNull();
  });
});

describe('suggestedProfileFrom', () => {
  it('uses the name and e-mail claims', () => {
    expect(suggestedProfileFrom(token({ name: ' Ada Byron ', email: 'ada@example.test' }))).toEqual(
      {
        displayName: 'Ada Byron',
        email: 'ada@example.test',
      },
    );
  });

  it('falls back to the given and family names and to a preferred username that is an address', () => {
    expect(
      suggestedProfileFrom(
        token({
          given_name: 'Ada',
          family_name: 'Byron',
          preferred_username: 'ada@corp.example.test',
        }),
      ),
    ).toEqual({ displayName: 'Ada Byron', email: 'ada@corp.example.test' });
  });

  it('does not take a username that is not an address for an e-mail', () => {
    expect(suggestedProfileFrom(token({ name: 'Ada', preferred_username: 'ada42' }))).toBeNull();
  });

  it('suggests nothing unless it has both a name and an address', () => {
    expect(suggestedProfileFrom(token({ name: 'Ada' }))).toBeNull();
    expect(suggestedProfileFrom(token({ email: 'ada@example.test' }))).toBeNull();
    expect(suggestedProfileFrom(null)).toBeNull();
    expect(suggestedProfileFrom('garbage')).toBeNull();
  });

  it('keeps the name within what the API accepts', () => {
    const suggested = suggestedProfileFrom(
      token({ name: 'x'.repeat(300), email: 'a@example.test' }),
    );
    expect(suggested?.displayName).toHaveLength(100);
  });
});
