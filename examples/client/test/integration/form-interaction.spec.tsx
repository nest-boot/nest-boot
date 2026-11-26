import { MockedProvider } from "@apollo/client/testing/react";
import { GraphQLError } from "graphql";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup } from "vitest-browser-react";
import { LoginForm } from "@/app/auth/components/login-form";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { SystemAccountFormPage } from "@/components/system-account-form-page";
import { WorkspaceServiceAccountForm } from "@/components/workspace-service-account-form";
import {
  SystemApiKeyPermission,
  WorkspacePermission,
  WorkspaceRole,
} from "@/gql/graphql";
import { graphql } from "@/gql";
import { createAbility, createAbilitySubject } from "@/lib/ability";
import { ensureTestI18n, renderWithRouter } from "./test-providers";
import type { MockedResponse } from "@apollo/client/testing";

const GET_SOCIAL_PROVIDERS = graphql(`
  query getSocialProvidersFromLoginForm {
    socialProviders {
      id
      name
    }
  }
`);

const GET_PASSWORD_POLICY = graphql(`
  query getPasswordPolicy {
    passwordPolicy {
      minLength
      maxLength
    }
  }
`);

const SIGN_IN_MUTATION = graphql(`
  mutation signInFromLoginForm($input: AuthSignInInput!) {
    signIn(input: $input) {
      user {
        id
      }
    }
  }
`);

const ADD_SERVICE_ACCOUNT = graphql(`
  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(
    $input: AddWorkspaceMemberInput!
  ) {
    addWorkspaceMember(input: $input) {
      id
    }
  }
`);

vi.mock("@/app/_authenticated/contexts/created-api-key-context", () => ({
  useCreatedApiKey: () => ({ secret: undefined }),
}));

vi.mock("@/app/_authenticated/contexts/auth-user-context", () => ({
  useAuthUserContext: () => ({ id: "administrator" }),
}));

afterEach(async () => {
  cleanup();
  await ensureTestI18n("en");
});

describe("LoginForm, WorkspaceServiceAccountForm, ApiKeyFormPage, and SystemAccountFormPage browser integration", () => {
  it("validates LoginForm registration password bounds, focuses invalid login inputs, and retries after server failure", async () => {
    const registerMocks: Array<MockedResponse> = [
      {
        request: { query: GET_SOCIAL_PROVIDERS },
        result: { data: { socialProviders: [] } },
      },
      {
        request: { query: GET_PASSWORD_POLICY },
        result: {
          data: { passwordPolicy: { minLength: 6, maxLength: 10 } },
        },
      },
    ];

    const registerView = await renderWithRouter(
      () => (
        <MockedProvider mocks={registerMocks}>
          <LoginForm mode="register" />
        </MockedProvider>
      ),
      "/auth/register",
    );

    await page.getByLabelText("Name").fill("Ada");
    await page.getByLabelText("Email").fill("ada@example.com");
    const registerPassword = page.getByLabelText("Password");
    await registerPassword.fill("12345");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();

    await expect
      .element(page.getByText("Password must contain at least 6 characters."))
      .toBeVisible();
    await registerPassword.fill("12345678901");
    await expect
      .element(page.getByText("Password must contain at most 10 characters."))
      .toBeVisible();
    registerView.unmount();

    let loginAttempts = 0;
    const loginMocks: Array<MockedResponse> = [
      {
        request: { query: GET_SOCIAL_PROVIDERS },
        result: { data: { socialProviders: [] } },
      },
      {
        request: {
          query: SIGN_IN_MUTATION,
          variables: {
            input: {
              email: "retry@example.com",
              password: "short",
              rememberMe: true,
            },
          },
        },
        result: () => {
          loginAttempts++;
          return {
            errors: [new GraphQLError("Temporary sign-in failure")],
          };
        },
      },
      {
        request: {
          query: SIGN_IN_MUTATION,
          variables: {
            input: {
              email: "retry@example.com",
              password: "short",
              rememberMe: true,
            },
          },
        },
        result: () => {
          loginAttempts++;
          return {
            errors: [new GraphQLError("Invalid credentials")],
          };
        },
      },
    ];

    await renderWithRouter(
      () => (
        <MockedProvider mocks={loginMocks}>
          <LoginForm mode="login" />
        </MockedProvider>
      ),
      "/auth/login",
    );

    const emailInput = page.getByLabelText("Email");
    const passwordInput = page.getByLabelText("Password");
    const signInButton = page.getByRole("button", {
      name: "Sign in",
      exact: true,
    });

    await signInButton.click();
    await expect.element(emailInput).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => document.activeElement).toBe(emailInput.element());
    expect(loginAttempts).toBe(0);

    await emailInput.fill("retry@example.com");
    await passwordInput.fill("short");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => loginAttempts).toBe(1);
    await expect
      .element(page.getByText("Temporary sign-in failure").first())
      .toBeVisible();

    // Blurring must keep the form-level request error visible
    emailInput.element().focus();
    (emailInput.element() as HTMLElement).blur();
    await expect
      .element(page.getByText("Temporary sign-in failure").first())
      .toBeVisible();

    await signInButton.click();
    await expect.poll(() => loginAttempts).toBe(2);
    await expect
      .element(page.getByText("Invalid credentials").first())
      .toBeVisible();
  });

  it("validates WorkspaceServiceAccountForm names across languages, preserves grants on failure, and navigates after retry", async () => {
    let attempts = 0;
    const mocks: Array<MockedResponse> = [
      {
        request: {
          query: ADD_SERVICE_ACCOUNT,
          variables: {
            input: {
              type: "SERVICE_ACCOUNT",
              name: "CI Runner",
              roles: [WorkspaceRole.MEMBER],
              permissions: [WorkspacePermission.WORKSPACE__READ],
            },
          },
        },
        result: () => {
          attempts++;
          return {
            errors: [new GraphQLError("Temporary service account failure")],
          };
        },
      },
      {
        request: {
          query: ADD_SERVICE_ACCOUNT,
          variables: {
            input: {
              type: "SERVICE_ACCOUNT",
              name: "CI Runner",
              roles: [WorkspaceRole.MEMBER],
              permissions: [WorkspacePermission.WORKSPACE__READ],
            },
          },
        },
        result: () => {
          attempts++;
          return {
            data: {
              addWorkspaceMember: {
                __typename: "WorkspaceMember",
                id: "member-42",
              },
            },
          };
        },
      },
    ];

    const { router, i18n } = await renderWithRouter(
      () => (
        <MockedProvider mocks={mocks}>
          <WorkspaceServiceAccountForm
            workspaceId="ws-9"
            roleOptions={[
              {
                role: WorkspaceRole.MEMBER,
                grantable: true,
              },
            ]}
            permissionOptions={[
              {
                permission: WorkspacePermission.WORKSPACE__READ,
                grantable: true,
              },
            ]}
          />
        </MockedProvider>
      ),
      "/workspaces/ws-9/members/create-service-account",
    );

    const nameInput = page.getByLabelText("Name");
    await nameInput.fill("   ");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect.element(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(attempts).toBe(0);

    // Bypass native maxlength to exercise localized Zod max-length validation
    await i18n.changeLanguage("zh");
    const zhNameEl = page.getByLabelText("姓名").element() as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(zhNameEl, "a".repeat(256));
    zhNameEl.dispatchEvent(new Event("input", { bubbles: true }));
    await expect
      .element(page.getByText("最多输入 255 个字符。", { exact: true }))
      .toBeVisible();

    await i18n.changeLanguage("en");
    await page.getByLabelText("Name").fill("CI Runner");
    await page.getByRole("checkbox", { name: "Member", exact: true }).click();
    await page.getByRole("checkbox", { name: /Read Workspace/i }).click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => attempts).toBe(1);
    await expect
      .element(page.getByText("Temporary service account failure"))
      .toBeVisible();
    await expect
      .element(page.getByRole("checkbox", { name: "Member", exact: true }))
      .toBeChecked();

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect
      .poll(() => router.state.location.pathname)
      .toBe("/workspaces/ws-9/members/member-42");
  });

  it("syncs incoming server snapshots in ApiKeyFormPage, confirms revocation via AlertDialog, and enforces SystemAccountFormPage field abilities", async () => {
    let releaseFirstSave!: () => void;
    const onSave = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstSave = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const onRevoke = vi.fn().mockResolvedValue(undefined);

    const baseKey = {
      id: "key-1",
      name: "Initial key",
      permissions: [
        SystemApiKeyPermission.USER__READ,
      ] as Array<SystemApiKeyPermission>,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      revokedAt: null,
      start: "sys_abc",
      prefix: "sys_",
      lastUsedAt: null,
      expiresAt: null,
    };

    const ability = createAbility([
      {
        actions: ["write"],
        subjects: ["SystemApiKey"],
        fields: ["name", "permissions", "revokedAt"],
        inverted: false,
      },
    ]);
    const subject = createAbilitySubject("SystemApiKey", baseKey);

    let updateServerKey!: (next: typeof baseKey) => void;
    function StatefulKeyEditor() {
      const [keyState, setKeyState] = useState(baseKey);
      updateServerKey = setKeyState;
      return (
        <ApiKeyFormPage
          apiKey={keyState}
          listPath="/admin/api-keys"
          permissionValues={Object.values(SystemApiKeyPermission)}
          permissionOptions={[
            {
              value: SystemApiKeyPermission.USER__READ,
              name: "Read Users",
              description: "",
            },
            {
              value: SystemApiKeyPermission.USER__UPDATE,
              name: "Update Users",
              description: "",
            },
          ]}
          canWrite={ability.can("write", subject)}
          canEditName={ability.can("write", subject, "name")}
          canEditPermissions={ability.can("write", subject, "permissions")}
          canRevoke={ability.can("write", subject, "revokedAt")}
          onSave={onSave}
          onRevoke={onRevoke}
        />
      );
    }

    const keyView = await renderWithRouter(
      () => <StatefulKeyEditor />,
      "/admin/api-keys/key-1",
    );

    const nameInput = page.getByLabelText("Name");
    await nameInput.fill("Draft key name");

    updateServerKey({
      ...baseKey,
      permissions: [
        SystemApiKeyPermission.USER__READ,
        SystemApiKeyPermission.USER__UPDATE,
      ],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    await expect.element(nameInput).toHaveValue("Draft key name");
    await expect
      .element(page.getByRole("checkbox", { name: "Update Users" }))
      .toBeChecked();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => onSave.mock.calls.length).toBe(1);
    await expect.element(nameInput).toBeDisabled();
    releaseFirstSave();
    await expect.element(nameInput).toBeEnabled();

    // Cancel and then confirm Revoke in real AlertDialog
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect
      .poll(() => document.querySelectorAll('[role="alertdialog"]').length)
      .toBe(0);
    expect(onRevoke).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    await expect.poll(() => onRevoke).toHaveBeenCalledOnce();
    keyView.unmount();

    const onToggle = vi.fn().mockResolvedValue(undefined);
    const onSystemSave = vi.fn().mockResolvedValue(undefined);
    await renderWithRouter(
      () => (
        <SystemAccountFormPage
          account={{
            id: "acc-1",
            name: "Automation",
            enabled: true,
            updatedAt: "2026-01-01T00:00:00.000Z",
            permissions: [],
          }}
          canWrite={true}
          canEditName={false}
          canEditPermissions={false}
          canToggle={true}
          options={[]}
          onSave={onSystemSave}
          onToggle={onToggle}
        />
      ),
      "/admin/system-accounts/acc-1",
    );

    await expect.element(page.getByLabelText("Name")).toBeDisabled();
    expect(document.querySelector('button[type="submit"]')).toBeNull();
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await expect.poll(() => onToggle).toHaveBeenCalledOnce();
    expect(onSystemSave).not.toHaveBeenCalled();
  });
});
