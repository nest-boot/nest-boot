/**
 * Per-operation options for encryption and decryption.
 */
export interface CryptOptions {
  /**
   * Optional HKDF domain-separation context (`info` parameter).
   * When omitted, the root key derived with an empty context is used.
   */
  context?: string;
}
