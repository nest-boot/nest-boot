/**
 * Derives a 32-byte key using HKDF-SHA256 via Web Crypto API.
 * @param secret - The input key material (any length)
 * @param context - Optional HKDF domain-separation context (`info` parameter)
 * @returns A 32-byte (256-bit) derived key suitable for AES-256
 */
export async function deriveKey(
  secret: string,
  context = "",
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const ikm = enc.encode(secret);
  const salt = new Uint8Array(0);
  const info = enc.encode(context);

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
