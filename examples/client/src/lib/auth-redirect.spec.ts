import { describe, expect, it } from "vitest";

import {
  createEmailVerificationCallbackUrl,
  createEmailVerificationPagePath,
  resolvePostAuthPath,
} from "./auth-redirect";

describe("auth redirect helpers", () => {
  it("keeps same-origin redirects and rejects external redirects", () => {
    expect(
      resolvePostAuthPath(
        "https://app.example.com/workspaces/one?tab=members",
        "https://app.example.com",
      ),
    ).toBe("/workspaces/one?tab=members");
    expect(
      resolvePostAuthPath(
        "https://attacker.example.com/steal",
        "https://app.example.com",
      ),
    ).toBe("/workspaces");
  });

  it("prefers a pending workspace invitation", () => {
    expect(
      resolvePostAuthPath(
        "/workspaces",
        "https://app.example.com",
        "invitation-1",
      ),
    ).toBe("/invite?invitationId=invitation-1");
  });

  it("builds pending and callback verification locations", () => {
    expect(
      createEmailVerificationPagePath(
        "user+test@example.com",
        "/workspaces/one",
      ),
    ).toBe(
      "/auth/verify-email?email=user%2Btest%40example.com&redirect=%2Fworkspaces%2Fone",
    );
    expect(
      createEmailVerificationCallbackUrl(
        "https://app.example.com",
        "/workspaces/one",
      ),
    ).toBe(
      "https://app.example.com/auth/verify-email?verified=true&redirect=%2Fworkspaces%2Fone",
    );
  });
});
