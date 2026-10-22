/** Encodes bytes the way a JWT segment is: base64url, without padding. Test-only: Node's Buffer is not in the app's types. */
export function base64Url(bytes: ArrayLike<number>): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** An unsigned JWT carrying the claims; the app only reads them, the API is what verifies a token. */
export function makeJwt(claims: unknown): string {
  const segment = (value: unknown) => base64Url(utf8(JSON.stringify(value)));
  return `${segment({ alg: 'none' })}.${segment(claims)}.signature`;
}
