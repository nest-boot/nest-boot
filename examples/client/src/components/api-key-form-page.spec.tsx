// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import apiKeyMessages from "../../public/locales/en/api-key.json";
import common from "../../public/locales/en/common.json";
import { Button } from "./thread-ui/button";
import { ApiKeyFormPage } from "./api-key-form-page";
import type { PageProps } from "./thread-ui/page";
import type { ReactNode } from "react";
import { SystemApiKeyPermission } from "@/gql/graphql";
import { createAbility, createAbilitySubject } from "@/lib/ability";

vi.mock("@/app/_authenticated/contexts/created-api-key-context", () => ({
  useCreatedApiKey: () => ({ secret: undefined }),
}));
vi.mock("@/components/thread-ui/alert-dialog", () => ({
  alertDialog: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/components/thread-ui/toast", () => ({ toast: { add: vi.fn() } }));
vi.mock("@/components/thread-ui/page", () => ({
  Page: ({ children, secondaryActions }: PageProps) => (
    <main>
      {secondaryActions?.map((action) => (
        <Button
          key={String(action.label)}
          onClick={action.onAction}
          disabled={action.disabled}
        >
          {action.label}
        </Button>
      ))}
      {children}
    </main>
  ),
}));

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: "en",
    defaultNS: "common",
    resources: { en: { common, "api-key": apiKeyMessages } },
  });
});
afterEach(cleanup);
function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
const apiKey = {
  id: "key",
  name: "Deployment",
  permissions: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  revokedAt: null,
  start: "sys_abc",
  prefix: "sys_",
  lastUsedAt: null,
  expiresAt: null,
};
function access(fields: Array<string>) {
  const ability = createAbility(
    fields.length
      ? [
          {
            actions: ["write"],
            subjects: ["SystemApiKey"],
            fields,
            inverted: false,
          },
        ]
      : [],
  );
  const subject = createAbilitySubject("SystemApiKey", apiKey);
  return {
    canWrite: ability.can("write", subject),
    canEditName: ability.can("write", subject, "name"),
    canEditPermissions: ability.can("write", subject, "permissions"),
    canRevoke: ability.can("write", subject, "revokedAt"),
  };
}
const props = {
  apiKey,
  listPath: "/admin/api-keys",
  permissionValues: Object.values(SystemApiKeyPermission),
  permissionOptions: [],
};

describe("ApiKeyFormPage field authorization", () => {
  it("allows a revocation-only actor to revoke without offering or submitting a metadata save", async () => {
    const onSave = vi.fn();
    const onRevoke = vi.fn();
    render(
      <ApiKeyFormPage
        {...props}
        {...access(["revokedAt"])}
        onSave={onSave}
        onRevoke={onRevoke}
      />,
      { wrapper },
    );
    expect(
      screen.getByLabelText<HTMLInputElement>(apiKeyMessages.form.name.label)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /Save$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete$/ })).toBeNull();
    fireEvent.submit(document.querySelector("form")!);
    fireEvent.click(screen.getByRole("button", { name: /Revoke$/ }));
    await waitFor(() => expect(onRevoke).toHaveBeenCalledOnce());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves an editable name while hiding a forbidden revoke operation", async () => {
    const onSave = vi.fn();
    const onRevoke = vi.fn();
    render(
      <ApiKeyFormPage
        {...props}
        {...access(["name"])}
        onSave={onSave}
        onRevoke={onRevoke}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByLabelText(apiKeyMessages.form.name.label), {
      target: { value: "Renamed deployment" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save$/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith({
        name: "Renamed deployment",
        permissions: [],
      }),
    );
    expect(screen.queryByRole("button", { name: /Revoke$/ })).toBeNull();
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it("keeps deletion available for a revoked key without an editable field", async () => {
    const onDelete = vi.fn();
    render(
      <ApiKeyFormPage
        {...props}
        apiKey={{ ...apiKey, revokedAt: "2026-02-01T00:00:00.000Z" }}
        {...access(["revokedAt"])}
        onSave={vi.fn()}
        onRevoke={vi.fn()}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    expect(screen.queryByRole("button", { name: /Save$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Revoke$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });
});
