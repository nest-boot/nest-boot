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
import admin from "../../public/locales/en/admin.json";
import common from "../../public/locales/en/common.json";
import { Button } from "./thread-ui/button";
import { SystemAccountFormPage } from "./system-account-form-page";
import type { PageProps } from "./thread-ui/page";
import type { ReactNode } from "react";
import { createAbility, createAbilitySubject } from "@/lib/ability";

vi.mock("@/app/_authenticated/contexts/current-user-context", () => ({
  useCurrentUserContext: () => ({ id: "administrator" }),
}));
vi.mock("@/hooks/use-resource-navigation", () => ({
  useResourceNavigation: () => ({ backSearch: {} }),
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
    resources: { en: { common, admin, "api-key": apiKeyMessages } },
  });
});
afterEach(cleanup);
function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
const account = {
  id: "account",
  name: "Deployment",
  enabled: true,
  permissions: [],
};
function access(fields: Array<string>) {
  const ability = createAbility(
    fields.length
      ? [
          {
            actions: ["write"],
            subjects: ["SystemAccount"],
            fields,
            inverted: false,
          },
        ]
      : [],
  );
  const subject = createAbilitySubject("SystemAccount", account);
  return {
    canWrite: ability.can("write", subject),
    canEditName: ability.can("write", subject, "name"),
    canEditPermissions: ability.can("write", subject, "permissions"),
    canToggle: ability.can("write", subject, "enabled"),
  };
}

describe("SystemAccountFormPage field authorization", () => {
  it("lets an enabled-field-only actor toggle without offering or submitting a metadata save", async () => {
    const onSave = vi.fn();
    const onToggle = vi.fn();
    render(
      <SystemAccountFormPage
        account={account}
        {...access(["enabled"])}
        options={[]}
        onSave={onSave}
        onToggle={onToggle}
      />,
      { wrapper },
    );
    expect(screen.queryByRole("button", { name: /Save$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete$/ })).toBeNull();
    fireEvent.submit(document.querySelector("form")!);
    fireEvent.click(screen.getByRole("button", { name: /Disable$/ }));
    await waitFor(() => expect(onToggle).toHaveBeenCalledOnce());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not offer secondary actions without their callbacks", () => {
    render(
      <SystemAccountFormPage
        account={account}
        {...access(["enabled"])}
        options={[]}
        onSave={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("saves an editable name without exposing a forbidden toggle", async () => {
    const onSave = vi.fn();
    render(
      <SystemAccountFormPage
        account={account}
        {...access(["name"])}
        options={[]}
        onSave={onSave}
        onToggle={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByLabelText(admin.users.table.name), {
      target: { value: "Renamed account" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save$/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith({
        name: "Renamed account",
      }),
    );
    expect(screen.queryByRole("button", { name: /Disable$/ })).toBeNull();
  });
});
