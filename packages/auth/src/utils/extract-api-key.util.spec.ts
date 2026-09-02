import type { Request } from "express";

import { extractApiKey } from "./extract-api-key.util.js";

describe("extractApiKey", () => {
  it("extracts case-insensitive Bearer credentials", () => {
    expect(
      extractApiKey({
        headers: { authorization: "bEaReR   sk-key" },
      } as Request),
    ).toBe("sk-key");
  });

  it("does not support x-api-key", () => {
    expect(
      extractApiKey({
        headers: { "x-api-key": "sk-key" },
      } as unknown as Request),
    ).toBeNull();
  });

  it.each([undefined, null])("returns null for %s requests", (request) => {
    expect(extractApiKey(request)).toBeNull();
  });

  it.each(["Basic token", "Bearer", ""])(
    "rejects unsupported authorization value %j",
    (authorization) => {
      expect(
        extractApiKey({ headers: { authorization } } as Request),
      ).toBeNull();
    },
  );
});
