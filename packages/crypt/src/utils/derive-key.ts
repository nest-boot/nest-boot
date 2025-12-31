/**
 * Derives a 32-byte key using HKDF-SHA256 via Web Crypto API.
 *
 * @param secret - The input key material (any length)
 * @returns A 32-byte (256-bit) derived key suitable for AES-256
 */
export async function deriveKey(secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const ikm = enc.encode(secret);
  const salt = enc.encode("");
  const info = enc.encode("");

  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info,
      },
      await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
      256, // 32 bytes = 256 bits
    ),
  );
}
