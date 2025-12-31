/**
 * Estimates the entropy of a string in bits.
 * This is a simple approximation that helps detect low-entropy secrets.
 *
 * @param str - The string to estimate entropy for
 * @returns The estimated entropy in bits
 */
export function estimateEntropy(str: string): number {
  const unique = new Set(str).size;
  if (unique === 0) return 0;
  return Math.log2(Math.pow(unique, str.length));
}
