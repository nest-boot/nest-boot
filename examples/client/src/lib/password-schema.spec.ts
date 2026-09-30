import { describe, expect, it, vi } from "vitest";
import {
  createExistingPasswordSchema,
  createPasswordSchema,
} from "./password-schema";

vi.mock("i18next", () => ({ t: (key: string) => key }));

describe("password validation", () => {
  it("allows existing passwords independently of current creation policy", () => {
    expect(createExistingPasswordSchema().safeParse("short").success).toBe(
      true,
    );
    expect(createExistingPasswordSchema().safeParse("").success).toBe(false);
  });
  it.each([
    { minLength: 6, maxLength: 16 },
    { minLength: 12, maxLength: 24 },
  ])("uses both server limits: %j", (policy) => {
    const schema = createPasswordSchema(policy);
    expect(schema.safeParse("x".repeat(policy.minLength - 1)).success).toBe(
      false,
    );
    expect(schema.safeParse("x".repeat(policy.minLength)).success).toBe(true);
    expect(schema.safeParse("x".repeat(policy.maxLength)).success).toBe(true);
    expect(schema.safeParse("x".repeat(policy.maxLength + 1)).success).toBe(
      false,
    );
  });
  it("does not silently fall back to hardcoded limits while policy is unavailable", () => {
    expect(
      createPasswordSchema().safeParse("long-enough-password").success,
    ).toBe(false);
  });
});
