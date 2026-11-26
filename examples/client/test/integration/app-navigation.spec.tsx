import { MockedProvider } from "@apollo/client/testing/react";
import { GraphQLError } from "graphql";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup } from "vitest-browser-react";
import { AdminSidebar } from "@/app/_authenticated/admin/components/admin-sidebar";
import { AuthUserProvider } from "@/app/_authenticated/contexts/auth-user-context";
import { UserSidebar } from "@/app/_authenticated/user/components/user-sidebar";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import { AbilityProvider } from "@/contexts/ability-context";
import { graphql } from "@/gql";
import { createAbility } from "@/lib/ability";
import { ensureTestI18n, renderWithRouter } from "./test-providers";
import type { MockedResponse } from "@apollo/client/testing";
import type { Workspace } from "@/components/thread-ui/sidebar-account-menu";

const GET_WORKSPACES_FROM_WORKSPACE_SWITCHER = graphql(`
  query getWorkspacesFromWorkspaceSwitcher(
    $first: Int
    $after: String
    $before: String
    $query: String
    $orderBy: WorkspaceOrder
  ) {
    currentUser {
      workspaces(
        first: $first
        after: $after
        before: $before
        query: $query
        orderBy: $orderBy
      ) {
        edges {
          node {
            id
            name
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`);

const SIGN_OUT_MUTATION = graphql(`
  mutation signOutFromSidebarUser {
    signOut
  }
`);

const currentUser = {
  __typename: "User" as const,
  id: "user-1",
  name: "Grace Hopper",
  email: "grace@example.com",
  updatedAt: "2026-01-01T00:00:00.000Z",
  permissions: [],
};

afterEach(async () => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
  await ensureTestI18n("en");
  await page.viewport(1280, 800);
});

function SidebarShell({
  kind = "user",
  subjects,
  workspace,
  mocks = [],
}: {
  kind?: "user" | "admin";
  subjects: Array<string>;
  workspace?: Workspace;
  mocks?: ReadonlyArray<MockedResponse>;
}) {
  const ability = createAbility(
    subjects.length ? [{ actions: ["read"], subjects, inverted: false }] : [],
  );

  return (
    <MockedProvider mocks={mocks}>
      <AuthUserProvider value={currentUser}>
        <AbilityProvider ability={ability}>
          <Layout>
            {kind === "admin" ? (
              <AdminSidebar workspace={workspace} />
            ) : (
              <UserSidebar workspace={workspace} />
            )}
            <LayoutContent>
              <div className="p-6">Route View</div>
            </LayoutContent>
          </Layout>
        </AbilityProvider>
      </AuthUserProvider>
    </MockedProvider>
  );
}

describe("UserSidebar, AdminSidebar, AppAccountMenu, and WorkspaceMenu integration", () => {
  it("filters UserSidebar and AdminSidebar links by CASL abilities and closes the mobile drawer on navigation", async () => {
    const restricted = await renderWithRouter(
      () => <SidebarShell kind="user" subjects={[]} />,
      "/user",
    );

    await expect
      .element(page.getByRole("link", { name: "Profile", exact: true }))
      .toBeVisible();
    expect(
      restricted.container.querySelector('a[href="/user/api-keys"]'),
    ).toBeNull();
    restricted.unmount();

    await page.viewport(390, 700);
    const mobileView = await renderWithRouter(
      () => <SidebarShell kind="user" subjects={["UserApiKey", "User"]} />,
      "/user",
    );

    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    const drawer = page.getByRole("dialog");
    await expect.element(drawer).toBeVisible();
    await expect
      .element(drawer.getByRole("link", { name: "API Keys", exact: true }))
      .toBeVisible();

    await drawer.getByRole("link", { name: "Security", exact: true }).click();
    await expect
      .poll(() => mobileView.router.state.location.pathname)
      .toBe("/user/security");
    await expect
      .poll(() => document.querySelectorAll('[role="dialog"]').length)
      .toBe(0);
    mobileView.unmount();

    await page.viewport(1280, 800);
    const adminView = await renderWithRouter(
      () => <SidebarShell kind="admin" subjects={["User", "SystemAccount"]} />,
      "/admin",
    );

    await expect
      .element(page.getByRole("link", { name: "Users", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "System Accounts", exact: true }))
      .toBeVisible();
    expect(
      adminView.container.querySelector('a[href="/admin/api-keys"]'),
    ).toBeNull();
  });

  it("suppresses workspace queries in personal mode, retries and paginates WorkspaceMenu, and switches language/theme/sign-out in UserMenu", async () => {
    let switcherCalls = 0;
    const personalView = await renderWithRouter(
      () => (
        <SidebarShell
          kind="user"
          subjects={["UserApiKey"]}
          mocks={[
            {
              request: {
                query: GET_WORKSPACES_FROM_WORKSPACE_SWITCHER,
                variables: { first: 10 },
              },
              result: () => {
                switcherCalls++;
                return { data: { currentUser: null } };
              },
            },
          ]}
        />
      ),
      "/user",
    );

    await page
      .getByRole("button", { name: "Account: Grace Hopper", exact: true })
      .click();
    await expect
      .element(
        page.getByRole("menuitem", { name: "Manage workspaces", exact: true }),
      )
      .toBeVisible();
    expect(switcherCalls).toBe(0);
    expect(document.querySelectorAll('[role="menuitemradio"]')).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
    personalView.unmount();

    const workspaceMocks: Array<MockedResponse> = [
      {
        request: {
          query: GET_WORKSPACES_FROM_WORKSPACE_SWITCHER,
          variables: { first: 10 },
        },
        result: {
          errors: [new GraphQLError("Temporary menu error")],
        },
      },
      {
        request: {
          query: GET_WORKSPACES_FROM_WORKSPACE_SWITCHER,
          variables: { first: 10 },
        },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              workspaces: {
                __typename: "WorkspaceConnection",
                edges: [
                  {
                    __typename: "WorkspaceEdge",
                    node: {
                      __typename: "Workspace",
                      id: "ws-1",
                      name: "Alpha Workspace",
                    },
                  },
                ],
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: "c1",
                  endCursor: "c1",
                },
              },
            },
          },
        },
      },
      {
        request: {
          query: GET_WORKSPACES_FROM_WORKSPACE_SWITCHER,
          variables: { first: 10, after: "c1" },
        },
        result: {
          data: {
            currentUser: {
              __typename: "User",
              workspaces: {
                __typename: "WorkspaceConnection",
                edges: [
                  {
                    __typename: "WorkspaceEdge",
                    node: {
                      __typename: "Workspace",
                      id: "ws-2",
                      name: "Beta Workspace",
                    },
                  },
                ],
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: false,
                  hasPreviousPage: false,
                  startCursor: "c2",
                  endCursor: "c2",
                },
              },
            },
          },
        },
      },
      {
        request: {
          query: SIGN_OUT_MUTATION,
        },
        result: {
          data: { signOut: true },
        },
      },
    ];

    const workspaceView = await renderWithRouter(
      () => (
        <SidebarShell
          kind="user"
          subjects={["User"]}
          workspace={{ id: "ws-1", name: "Alpha Workspace" }}
          mocks={workspaceMocks}
        />
      ),
      "/workspaces/ws-1",
    );

    const accountTrigger = page.getByRole("button", {
      name: /^(Workspace and account:|工作空间与账号：)/,
    });
    await accountTrigger.click();

    const retryItem = page.getByRole("menuitem", {
      name: "Retry loading workspaces",
      exact: true,
    });
    await expect.element(retryItem).toBeVisible();
    await retryItem.click();

    const loadMoreItem = page.getByRole("menuitem", {
      name: "Load more",
      exact: true,
    });
    await expect.element(loadMoreItem).toBeVisible();
    await loadMoreItem.click();

    await expect
      .element(
        page.getByRole("menuitemradio", {
          name: "Beta Workspace",
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(
        page.getByRole("menuitem", { name: "Administration", exact: true }),
      )
      .toBeVisible();

    // Switch theme to Dark
    await page.getByRole("menuitem", { name: "Theme", exact: true }).click();
    await page
      .getByRole("menuitemradio", { name: "Dark", exact: true })
      .click();
    await expect
      .poll(() => document.documentElement.classList.contains("dark"))
      .toBe(true);

    // Switch UI language to Chinese and sign out
    await accountTrigger.click();
    await page.getByRole("menuitem", { name: "Language", exact: true }).click();
    await page
      .getByRole("menuitemradio", { name: "简体中文", exact: true })
      .click();
    await expect
      .element(page.getByRole("link", { name: "个人资料", exact: true }))
      .toBeVisible();

    await accountTrigger.click();
    await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
    await expect
      .poll(() => workspaceView.router.state.location.pathname)
      .toBe("/auth/login");
  });
});
