/** Browser equivalent of @nest-boot/graphql-connection's base64 JSON cursor. */
export function encodeConnectionCursor(position: {
  id: string;
  value?: unknown;
}): string {
  const bytes = new TextEncoder().encode(JSON.stringify(position));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
