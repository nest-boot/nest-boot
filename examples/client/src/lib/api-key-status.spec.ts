import { describe, expect, it } from "vitest";

import { getApiKeyStatus } from "./api-key-status";

describe("getApiKeyStatus", () => {
  it("returns disabled before evaluating expiration", () => {
    expect(
      getApiKeyStatus({
        enabled: false,
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toEqual({ color: "gray", label: "disabled" });
  });

  it("returns expired for an enabled key past its expiration", () => {
    expect(
      getApiKeyStatus({
        enabled: true,
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toEqual({ color: "yellow", label: "expired" });
  });

  it("returns active for an enabled key without a past expiration", () => {
    expect(getApiKeyStatus({ enabled: true, expiresAt: null })).toEqual({
      color: "green",
      label: "active",
    });
    expect(
      getApiKeyStatus({
        enabled: true,
        expiresAt: "2999-01-01T00:00:00.000Z",
      }),
    ).toEqual({ color: "green", label: "active" });
  });
});
