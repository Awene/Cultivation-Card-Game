const encoder = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Bytes(value: string | ArrayBuffer): Promise<Uint8Array> {
  const input = typeof value === 'string' ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  return bytesToHex(await sha256Bytes(value));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return bytesToBase64Url(await sha256Bytes(verifier));
}

export function safeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < a.byteLength; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

