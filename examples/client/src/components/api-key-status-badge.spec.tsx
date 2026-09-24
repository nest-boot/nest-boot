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
  it("shows Disabled even when the key has also expired", () => {
    render(
      <ApiKeyStatusBadge
        apiKey={{ enabled: false, expiresAt: "2000-01-01T00:00:00.000Z" }}
      />,
      { wrapper },
    );
    expect(screen.getByText("Disabled").getAttribute("data-slot")).toBe(
      "badge",
    );
    expect(screen.queryByText("Expired")).toBeNull();
  });

  it("shows Expired for an enabled key past its expiration", () => {
    render(
      <ApiKeyStatusBadge
        apiKey={{ enabled: true, expiresAt: "2000-01-01T00:00:00.000Z" }}
      />,
      { wrapper },
    );
    expect(screen.getByText("Expired").getAttribute("data-slot")).toBe("badge");
  });

  it("shows Active without a past expiration and updates when disabled", () => {
    const { rerender } = render(
      <ApiKeyStatusBadge apiKey={{ enabled: true }} />,
      { wrapper },
    );
    expect(screen.getByText("Active").getAttribute("data-slot")).toBe("badge");
    for (const expiresAt of [null, "2999-01-01T00:00:00.000Z"]) {
      rerender(<ApiKeyStatusBadge apiKey={{ enabled: true, expiresAt }} />);
      expect(screen.getByText("Active")).toBeTruthy();
    }
    rerender(<ApiKeyStatusBadge apiKey={{ enabled: false }} />);
    expect(screen.getByText("Disabled")).toBeTruthy();
    expect(screen.queryByText("Active")).toBeNull();
  });
});
