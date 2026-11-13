// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import en from "../../public/locales/en/api-key.json";
import { ApiKeyStatusBadge } from "./api-key-status-badge";
import type { ReactNode } from "react";

const i18n = createInstance();

beforeAll(async () => {
  await i18n.init({ lng: "en", resources: { en: { "api-key": en } } });
});

afterEach(cleanup);

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe("ApiKeyStatusBadge", () => {
  it("shows Revoked even when the key has also expired", () => {
    render(
      <ApiKeyStatusBadge
        apiKey={{
          revokedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2000-01-01T00:00:00.000Z",
        }}
      />,
      { wrapper },
    );
    expect(screen.getByText("Revoked").getAttribute("data-slot")).toBe("badge");
    expect(screen.queryByText("Expired")).toBeNull();
  });

  it("shows Expired for an unrevoked key past its expiration", () => {
    render(
      <ApiKeyStatusBadge
        apiKey={{ revokedAt: null, expiresAt: "2000-01-01T00:00:00.000Z" }}
      />,
      { wrapper },
    );
    expect(screen.getByText("Expired").getAttribute("data-slot")).toBe("badge");
  });

  it("shows Active without a past expiration and updates when revoked", () => {
    const { rerender } = render(
      <ApiKeyStatusBadge apiKey={{ revokedAt: null }} />,
      { wrapper },
    );
    expect(screen.getByText("Active").getAttribute("data-slot")).toBe("badge");
    for (const expiresAt of [null, "2999-01-01T00:00:00.000Z"]) {
      rerender(<ApiKeyStatusBadge apiKey={{ revokedAt: null, expiresAt }} />);
      expect(screen.getByText("Active")).toBeTruthy();
    }
    rerender(
      <ApiKeyStatusBadge apiKey={{ revokedAt: "2026-01-01T00:00:00.000Z" }} />,
    );
    expect(screen.getByText("Revoked")).toBeTruthy();
    expect(screen.queryByText("Active")).toBeNull();
  });
});
