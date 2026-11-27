import { deriveKey } from "./derive-key.util.js";

describe("deriveKey", () => {
  const secret = "myTestSecretThatIsAtLeast32Chars!";

  it("derives a deterministic 32-byte key for a secret", async () => {
    const first = await deriveKey(secret);
    const second = await deriveKey(secret, "");

    expect(first).toHaveLength(32);
    expect(first).toEqual(second);
  });

  it("derives distinct keys across secrets and contexts", async () => {
    const rootKey = await deriveKey(secret);
    const jwtKey = await deriveKey(secret, "jwt");
    const otherSecretKey = await deriveKey(
      "anotherSecretThatIsAtLeast32Char!",
      "jwt",
    );

    expect(jwtKey).toHaveLength(32);
    expect(jwtKey).not.toEqual(rootKey);
    expect(jwtKey).not.toEqual(otherSecretKey);
  });
});
