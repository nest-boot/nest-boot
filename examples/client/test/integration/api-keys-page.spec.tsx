import { useLocation } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup } from "vitest-browser-react";
import { ApiKeysPage } from "@/components/api-keys-page";
import { UserApiKeyPermission } from "@/gql/graphql";
import { createAbility } from "@/lib/ability";
import { ensureTestI18n, renderWithRouter } from "./test-providers";
import type { ApiKeyRow } from "@/components/api-keys-page";
import type { ApiKeySearch } from "@/schemas/api-key-search-schema";

const sampleKeys: Array<ApiKeyRow<UserApiKeyPermission>> = [
  {
    id: "key-1",
    name: "Production deploy",
    start: "user_live12",
    prefix: "user_",
    revokedAt: null,
    permissions: [UserApiKeyPermission.USER_API_KEY__READ],
    createdAt: "2026-01-15",
    lastUsedAt: null,
    expiresAt: null,
    owner: {
      id: "sa-1",
      name: "Release Bot",
      type: "SERVICE_ACCOUNT",
    },
  },
  {
    id: "key-2",
    name: "Legacy key",
    start: "",
    prefix: "user_old",
    revokedAt: "2026-02-01T00:00:00.000Z",
    permissions: [],
    createdAt: "2026-01-10",
    lastUsedAt: "2026-02-01T08:00:00.000Z",
    expiresAt: "2026-12-31",
    owner: null,
  },
];

afterEach(async () => {
  cleanup();
  await ensureTestI18n("en");
  await page.viewport(1280, 800);
});

function RoutedApiKeysPage({
  canWrite,
  showOwner = true,
}: {
  canWrite: boolean;
  showOwner?: boolean;
}) {
  const location = useLocation();
  const search = location.search as ApiKeySearch;
  const ability = createAbility([
    { actions: ["read"], subjects: ["UserApiKey"], inverted: false },
    ...(canWrite
      ? [{ actions: ["write"], subjects: ["UserApiKey"], inverted: false }]
      : []),
  ]);

  return (
    <ApiKeysPage
      subject="UserApiKey"
      ability={ability}
      title="API Keys"
      description="Manage credentials"
      search={search}
      apiKeys={sampleKeys}
      showOwner={showOwner}
      ownerPath={(owner) =>
        owner.type === "SERVICE_ACCOUNT"
          ? `/workspaces/ws-1/members/${owner.id}`
          : undefined
      }
      createPath="/user/api-keys/create"
      detailPath={(id) => `/user/api-keys/${id}`}
      pageInfo={{
        hasPreviousPage: false,
        hasNextPage: true,
        startCursor: "cursor-start",
        endCursor: "cursor-end",
      }}
    />
  );
}

describe("ApiKeysPage browser integration", () => {
  it("gates the Create action by CASL ability, renders owners/status badges, and updates localized fallbacks live", async () => {
    const readOnlyView = await renderWithRouter(
      () => <RoutedApiKeysPage canWrite={false} />,
      "/user/api-keys",
    );

    await expect
      .element(page.getByRole("button", { name: "Create", exact: true }))
      .toBeDisabled();
    await expect
      .element(page.getByRole("link", { name: "Release Bot", exact: true }))
      .toHaveAttribute("href", "/workspaces/ws-1/members/sa-1");
    await expect
      .element(page.getByText("Active", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Revoked", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("user_live12...", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("user_old...", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Never used", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Never expires", { exact: true }))
      .toBeVisible();

    await readOnlyView.i18n.changeLanguage("zh");
    await expect
      .element(page.getByText("从未使用", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("永不过期", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("已撤销", { exact: true }))
      .toBeVisible();

    readOnlyView.unmount();

    const writableView = await renderWithRouter(
      () => <RoutedApiKeysPage canWrite={true} showOwner={false} />,
      "/user/api-keys",
    );
    const createButton = page.getByRole("button", {
      name: "Create",
      exact: true,
    });
    await expect.element(createButton).toBeEnabled();
    await createButton.click();
    await expect
      .poll(() => writableView.router.state.location.pathname)
      .toBe("/user/api-keys/create");
  });

  it("updates URL search/filter parameters, paginates cursors, and navigates to key details on row click", async () => {
    await page.viewport(390, 800);
    const { router } = await renderWithRouter(
      () => <RoutedApiKeysPage canWrite={true} />,
      "/user/api-keys",
    );

    const searchInput = page.getByRole("textbox", {
      name: "Search",
      exact: true,
    });
    await searchInput.fill("deploy");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ query: "deploy" });

    await page.getByRole("button", { name: "Add Filter", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Key Prefix", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Key Prefix", exact: true })
      .fill("user_");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");

    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({
        query: "deploy",
        filter: { prefix: { $eq: "user_" } },
      });

    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({
        after: "cursor-end",
      });

    await page.getByText("user_live12...", { exact: true }).click();
    await expect
      .poll(() => router.state.location.pathname)
      .toBe("/user/api-keys/key-1");
  });
});
