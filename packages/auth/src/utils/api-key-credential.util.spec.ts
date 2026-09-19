import { createHash } from "node:crypto";

import { generateApiKey, hashApiKey } from "./api-key-credential.util.js";

describe("API-key credentials", () => {
  it.each([
    "",
    "1key",
    "UPPER",
    "a-b",
    "a_b",
    "a b",
    "a\n",
    "a\r\n",
    "é",
    "a".repeat(33),
  ])("rejects invalid prefix %j", (prefix) => {
    expect(() => generateApiKey(prefix)).toThrow("API key prefix");
  });

  it.each(["sk", "a", "a1", "a".repeat(32)])(
    "generates high-entropy credentials with prefix %s and hashes the complete value",
    (prefix) => {
      const key = generateApiKey(prefix);
      expect(key.slice(0, prefix.length)).toBe(prefix);
      expect(key.slice(prefix.length)).toMatch(/^[a-zA-Z0-9_-]{64}$/u);
      expect(hashApiKey(key)).toBe(
        createHash("sha256").update(key).digest("base64url"),
      );
      expect(hashApiKey(key)).not.toContain(key);
      expect(generateApiKey(prefix)).not.toBe(key);
    },
  );
});
