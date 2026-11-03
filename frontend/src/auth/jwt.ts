import type { SuggestedProfile } from './types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlToBytes(input: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of input.replace(/=+$/, '')) {
    const normalised = char === '+' ? '-' : char === '/' ? '_' : char;
    const value = ALPHABET.indexOf(normalised);
    if (value < 0) {
      throw new Error('Not base64url.');
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/** The claims of a JWT, read without verifying it: the API verifies tokens, the app only reads a name from one. */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const hex = base64UrlToBytes(parts[1])
      .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
      .join('');
    const claims: unknown = JSON.parse(decodeURIComponent(hex));
    return claims !== null && typeof claims === 'object' && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A name and an e-mail address from an ID token, when it carries both. */
export function suggestedProfileFrom(idToken: string | null | undefined): SuggestedProfile | null {
  const claims = idToken ? decodeJwtClaims(idToken) : null;
  if (!claims) {
    return null;
  }
  const preferred = text(claims.preferred_username);
  const email = text(claims.email) ?? (preferred && EMAIL_SHAPE.test(preferred) ? preferred : null);
  const given = text(claims.given_name);
  const family = text(claims.family_name);
  const displayName =
    text(claims.name) ?? (given || family ? [given, family].filter(Boolean).join(' ') : null);
  if (!email || !displayName) {
    return null;
  }
  return { displayName: displayName.slice(0, 100), email };
}
