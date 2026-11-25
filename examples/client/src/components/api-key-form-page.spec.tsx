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
import { SystemApiKeyPermission } from "@/gql/graphql";
import { createAbility, createAbilitySubject } from "@/lib/ability";
import apiKeyMessages from "../../public/locales/en/api-key.json";
import common from "../../public/locales/en/common.json";
import { Button } from "./thread-ui/button";
import { ApiKeyFormPage } from "./api-key-form-page";
import type { PageProps } from "./thread-ui/page";
import type { ReactNode } from "react";

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
  permissions: [] as Array<SystemApiKeyPermission>,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
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
  it("syncs refreshed grants without losing drafts or restoring a revoked permission", async () => {
    let release!: () => void;
    const onSave = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const read = SystemApiKeyPermission.USER__READ;
    const update = SystemApiKeyPermission.USER__UPDATE;
    const editor = (key: typeof apiKey) => (
      <ApiKeyFormPage
        {...props}
        apiKey={key}
        {...access(["name", "permissions"])}
        permissionOptions={[read, update].map((value) => ({
          value,
          name: value,
          description: "",
        }))}
        onSave={onSave}
      />
    );
    const { rerender } = render(editor({ ...apiKey, permissions: [read] }), {
      wrapper,
    });
    const name = screen.getByLabelText<HTMLInputElement>(
      apiKeyMessages.form.name.label,
    );
    const readGrant = screen.getByRole("checkbox", { name: read });
    const updateGrant = screen.getByRole("checkbox", { name: update });
    const save = screen.getByRole<HTMLButtonElement>("button", {
      name: /Save$/,
    });
    fireEvent.change(name, { target: { value: "Draft name" } });
    rerender(editor({ ...apiKey, updatedAt: "2026-01-02T00:00:00.000Z" }));
    expect(name.value).toBe("Draft name");
    expect(readGrant.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith(
        { name: "Draft name", permissions: [] },
        { name: "Draft name" },
      ),
    );
    // Refreshed server data can arrive before the save finishes.
    rerender(
      editor({
        ...apiKey,
        name: "Draft name",
        permissions: [update],
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
    );
    fireEvent.change(name, { target: { value: "Next name" } });
    release();
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(name.value).toBe("Next name");
    await waitFor(() =>
      expect(updateGrant.getAttribute("aria-checked")).toBe("true"),
    );
    expect(readGrant.getAttribute("aria-checked")).toBe("false");
    // An intentional grant edit must start from the refreshed set.
    fireEvent.click(updateGrant);
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        { name: "Next name", permissions: [] },
        { name: "Next name", permissions: [] },
      ),
    );
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(name.value).toBe("Next name");
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(onSave).toHaveBeenCalledTimes(2);
    rerender(
      editor({
        ...apiKey,
        name: "Draft name",
        permissions: [update],
        updatedAt: "2026-01-04T00:00:00.000Z",
      }),
    );
    expect(name.value).toBe("Draft name");
    expect(updateGrant.getAttribute("aria-checked")).toBe("true");
    expect(save.disabled).toBe(false);
    // Ignore whitespace-only edits while preserving an explicit permissions draft.
    fireEvent.change(name, { target: { value: "Draft name " } });
    fireEvent.click(updateGrant);
    rerender(
      editor({
        ...apiKey,
        name: "Another server name",
        permissions: [read],
        updatedAt: "2026-01-05T00:00:00.000Z",
      }),
    );
    expect(name.value).toBe("Another server name");
    expect(updateGrant.getAttribute("aria-checked")).toBe("false");
    expect(readGrant.getAttribute("aria-checked")).toBe("false");
  });

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
      expect(onSave).toHaveBeenCalledExactlyOnceWith(
        { name: "Renamed deployment", permissions: [] },
        { name: "Renamed deployment" },
      ),
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
