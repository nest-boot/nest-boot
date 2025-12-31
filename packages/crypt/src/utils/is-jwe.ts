/**
 * Checks if a string is a valid JWE (JSON Web Encryption) compact serialization.
 *
 * JWE compact serialization format:
 * BASE64URL(UTF8(JWE Protected Header)) || '.' ||
 * BASE64URL(JWE Encrypted Key) || '.' ||
 * BASE64URL(JWE Initialization Vector) || '.' ||
 * BASE64URL(JWE Ciphertext) || '.' ||
 * BASE64URL(JWE Authentication Tag)
 *
 * @param value - The string to check
 * @returns true if the string appears to be a valid JWE
 */
export function isJwe(value: string): boolean {
  // JWE compact serialization has exactly 5 parts
  const parts = value.split(".");
  if (parts.length !== 5) {
    return false;
  }

  // Try to decode and validate the protected header (first part)
  try {
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as unknown;

    // JWE header must have 'alg' and 'enc' fields
    return (
      typeof header === "object" &&
      header !== null &&
      "alg" in header &&
      "enc" in header &&
      typeof (header as { alg: unknown }).alg === "string" &&
      typeof (header as { enc: unknown }).enc === "string"
    );
  } catch {
    return false;
  }
}
