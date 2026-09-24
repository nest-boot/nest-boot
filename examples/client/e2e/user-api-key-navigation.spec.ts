import { expect, test } from "@playwright/test";
import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import type { Page } from "@playwright/test";

async function prepareKeys(page: Page) {
  const seed = uniqueSeed("key-navigation");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Navigation tester",
  });
  const keys: Array<{ id: string; name: string }> = [];
  for (const name of [
    "Navigation A",
    "Navigation B",
    "Navigation C",
    "Navigation D",
    "Unrelated",
  ]) {
    const data = await graphqlRequest<{
      createUserApiKey: { entity: { id: string; name: string } };
    }>(
      page.request,
      `
      mutation ($name: String!) {
        createUserApiKey(input: { name: $name, permissions: [] }) { entity { id name } }
      }
    `,
      { name },
    );
    keys.push(data.createUserApiKey.entity);
  }
  return keys;
}

const query = ["A", "B", "C", "D"]
  .map((letter) => JSON.stringify(`Navigation ${letter}`))
  .join(" OR ");
const filter = { created_at: { $gte: "2000-01-01T00:00:00.000Z" } };
function listPath(field = "ID", direction = "ASC") {
  const params = new URLSearchParams({
    first: "2",
    query,
    filter: JSON.stringify(filter),
    orderBy: JSON.stringify({ field, direction }),
  });
  return `/user/api-keys?${params}`;
}

function readSearch(page: Page) {
  const search = new URL(page.url()).searchParams;
  return {
    first: Number(search.get("first")),
    query: search.get("query"),
    filter: JSON.parse(search.get("filter") ?? "null"),
    orderBy: JSON.parse(search.get("orderBy") ?? "null"),
    after: search.get("after"),
  };
}

async function expectDetails(page: Page, name: string) {
  await expect(page.getByTestId("api-key-rename-input")).toHaveValue(name);
}
async function expectNeighbor(
  page: Page,
  direction: "previous" | "next",
  id: string,
) {
  await expect(page.getByTestId(`api-key-${direction}`)).toHaveAttribute(
    "href",
    `/user/api-keys/${id}`,
  );
}

async function expectSavedPosition(page: Page, previousId?: string) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const entry = Object.entries(sessionStorage).find(
          ([key]) =>
            key.startsWith("page-search:v1:") && key.endsWith(',"api-keys"]'),
        );
        if (!entry) return null;
        const search = JSON.parse(entry[1]);
        return {
          ...search,
          after: search.after ? JSON.parse(atob(search.after)).id : null,
        };
      }),
    )
    .toMatchObject({
      first: 2,
      query,
      filter,
      orderBy: { field: "ID", direction: "ASC" },
      after: previousId ?? null,
    });
}

test("browses details across pages, survives back and refresh, then anchors the filtered list at the current key", async ({
  page,
}) => {
  const [a, b, c, d] = await prepareKeys(page);
  await page.goto(listPath());
  await expect(
    page.getByRole("link", { name: a.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: c.name });
  await row.getByRole("cell").nth(2).click();
  await expectDetails(page, c.name);
  await expectNeighbor(page, "previous", b.id);
  await expectNeighbor(page, "next", d.id);
  const pagination = page.locator('[data-slot="page-pagination"]');
  await expect(pagination).toBeVisible();
  const desktopViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pagination).toBeHidden();
  await expectDetails(page, c.name);
  await page.setViewportSize(desktopViewport);
  await expect(pagination).toBeVisible();
  await page.getByTestId("api-key-previous").click();
  await expectDetails(page, b.name);
  await expectNeighbor(page, "previous", a.id);
  await expectSavedPosition(page, a.id);
  await page.getByTestId("api-key-previous").click();
  await expectDetails(page, a.name);
  await expectNeighbor(page, "next", b.id);
  await expect(page.getByTestId("api-key-previous")).toBeDisabled();
  await expect
    .poll(async () => {
      const firstPage = new URL(
        (await page.getByTestId("api-key-back").getAttribute("href"))!,
        page.url(),
      );
      return {
        after: firstPage.searchParams.get("after"),
        query: firstPage.searchParams.get("query"),
      };
    })
    .toEqual({ after: null, query });
  await expectSavedPosition(page);
  await page.goBack();
  await expectDetails(page, b.name);
  await expectSavedPosition(page, a.id);
  await page.goBack();
  await expectDetails(page, c.name);
  await expectSavedPosition(page, b.id);
  await page.reload();
  await expectNeighbor(page, "previous", b.id);
  await page.getByTestId("api-key-next").click();
  await expectDetails(page, d.name);
  await expectNeighbor(page, "previous", c.id);
  await expect(page.getByTestId("api-key-next")).toBeDisabled();
  await expectSavedPosition(page, c.id);
  await page.getByTestId("api-key-previous").click();
  await expectDetails(page, c.name);
  await expectNeighbor(page, "previous", b.id);
  await page.getByTestId("api-key-back").click();
  await expect(page.getByRole("row").nth(1)).toContainText(c.name);
  await expect(page.getByRole("row").nth(2)).toContainText(d.name);
  const restored = readSearch(page);
  expect(restored).toMatchObject({
    first: 2,
    query,
    filter,
    orderBy: { field: "ID", direction: "ASC" },
  });
  expect(JSON.parse(Buffer.from(restored.after!, "base64").toString())).toEqual(
    { id: b.id, value: b.id },
  );
  // The breadcrumb uses the same destination as the footer.
  await page.getByRole("link", { name: c.name, exact: true }).click();
  await expectNeighbor(page, "previous", b.id);
  await page.getByRole("button", { name: "上级页面" }).click();
  await page.getByRole("menuitem", { name: "API 密钥", exact: true }).click();
  await expect(page.getByRole("row").nth(1)).toContainText(c.name);
  expect(readSearch(page)).toEqual(restored);
});

test("ignores a delayed lazy-query result after browser back to another record", async ({
  page,
}) => {
  const [, b, c, d] = await prepareKeys(page);
  let releaseOldQuery!: () => void;
  const pending = new Promise<void>((resolve) => {
    releaseOldQuery = resolve;
  });
  let pendingQueries = 0;
  await page.route("**/api/graphql", async (route) => {
    const body = route.request().postDataJSON() as {
      operationName?: string;
      variables?: { cursor: string };
    };
    if (body.operationName !== "getUserApiKeyNeighbors") {
      await route.continue();
      return;
    }
    const id = JSON.parse(
      Buffer.from(body.variables!.cursor, "base64").toString(),
    ).id as string;
    if (id !== b.id) {
      await route.continue();
      return;
    }
    pendingQueries++;
    try {
      const response = await route.fetch();
      await pending;
      await route.fulfill({ response });
    } catch {
      // Apollo may abort the superseded request when executing the new one.
    } finally {
      pendingQueries--;
    }
  });
  try {
    await page.goto(listPath());
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await page.getByRole("link", { name: c.name, exact: true }).click();
    await expectNeighbor(page, "previous", b.id);
    await expectNeighbor(page, "next", d.id);
    await expectSavedPosition(page, b.id);
    await page.getByTestId("api-key-previous").click();
    await expectDetails(page, b.name);
    await expect.poll(() => pendingQueries).toBeGreaterThan(0);
    await expect(page.getByTestId("api-key-previous")).toBeDisabled();
    await expect(page.getByTestId("api-key-next")).toBeDisabled();
    await expectSavedPosition(page, b.id);
    await page.goBack();
    await expectDetails(page, c.name);
    await expectNeighbor(page, "previous", b.id);
    await expectNeighbor(page, "next", d.id);
    releaseOldQuery();
    await expect.poll(() => pendingQueries).toBe(0);
    await expectSavedPosition(page, b.id);
    await expectNeighbor(page, "previous", b.id);
    await expectNeighbor(page, "next", d.id);
  } finally {
    releaseOldQuery();
  }
});

test("restores the exact list search from create/cancel and create/success, without storing the secret", async ({
  page,
}) => {
  await prepareKeys(page);
  await page.goto(listPath());
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByRole("row").nth(1)).toContainText("Navigation C");
  const original = readSearch(page);
  await page.getByTestId("api-key-create-action").click();
  await page.reload();
  await page.getByTestId("api-key-back").click();
  await expect(page.getByRole("row").nth(1)).toContainText("Navigation C");
  expect(readSearch(page)).toEqual(original);
  await page.getByTestId("api-key-create-action").click();
  await page.getByTestId("api-key-name-input").fill("Created sample");
  await page.getByTestId("api-key-create-submit").click();
  const secret = page.getByTestId("api-key-created-value");
  await expect(secret).toBeVisible();
  const value = await secret.textContent();
  expect(
    await page.evaluate(
      (secretValue) => JSON.stringify(sessionStorage).includes(secretValue!),
      value,
    ),
  ).toBe(false);
  await page.getByTestId("api-key-back").click();
  await expect(page.getByRole("row").nth(1)).toContainText("Navigation C");
  expect(readSearch(page)).toEqual(original);
  // An explicit bare list URL is authoritative; it resets saved filters.
  await page.goto("/user/api-keys");
  await page.getByTestId("api-key-create-action").click();
  await page.getByTestId("api-key-back").click();
  await expect(page.getByTestId("api-keys-page")).toBeVisible();
  expect(readSearch(page).query).toBeNull();
});

test("handles invalid storage, direct detail entry and failed neighbor queries", async ({
  page,
}) => {
  const [a, b, c, d] = await prepareKeys(page);
  await page.goto(listPath());
  await expect(
    page.getByRole("link", { name: a.name, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find(
      (key) =>
        key.startsWith("page-search:v1:") && key.endsWith(',"api-keys"]'),
    )!;
    sessionStorage.setItem(key, "broken json");
  });
  await page.goto(`/user/api-keys/${b.id}`);
  await expectDetails(page, b.name);
  // Direct-entry defaults are CREATED_AT DESC, not the previous ascending search.
  await expectNeighbor(page, "previous", c.id);
  await expectNeighbor(page, "next", a.id);
  const directBackUrl = new URL(
    (await page.getByTestId("api-key-back").getAttribute("href"))!,
    page.url(),
  );
  expect(directBackUrl.searchParams.get("after")).toBeNull();
  expect(directBackUrl.searchParams.get("query")).toBeNull();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter(
        (key) =>
          key.startsWith("page-search:v1:") && key.endsWith(',"api-keys"]'),
      ),
    ),
  ).toEqual([]);
  await page.goto(listPath());
  await expect(
    page.getByRole("link", { name: b.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(
    page.getByRole("link", { name: c.name, exact: true }),
  ).toBeVisible();
  const original = readSearch(page);
  expect(original.after).not.toBeNull();
  let fail = true;
  await page.route("**/api/graphql", async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string };
    if (body.operationName === "getUserApiKeyNeighbors" && fail) {
      await route.fulfill({
        json: { errors: [{ message: "Simulated neighbor failure" }] },
      });
    } else await route.continue();
  });
  await page.getByRole("link", { name: c.name, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("无法加载相邻 API 密钥");
  await expect(page.getByTestId("api-key-previous")).toBeDisabled();
  await expect(page.getByTestId("api-key-next")).toBeDisabled();
  const fallback = new URL(
    (await page.getByTestId("api-key-back").getAttribute("href"))!,
    page.url(),
  );
  expect(fallback.searchParams.get("query")).toBe(query);
  expect(fallback.searchParams.get("after")).toBe(original.after);
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expectNeighbor(page, "previous", b.id);
  await expectNeighbor(page, "next", d.id);
});

for (const field of ["CREATED_AT", "LAST_USED_AT"]) {
  test(`uses ${field} DESC cursors including null values to navigate and return`, async ({
    page,
  }) => {
    const [a, b, c, d] = await prepareKeys(page);
    await page.goto(listPath(field, "DESC"));
    await expect(page.getByRole("row").nth(1)).toContainText(d.name);
    await page.getByRole("link", { name: c.name, exact: true }).click();
    await expectNeighbor(page, "previous", d.id);
    await expectNeighbor(page, "next", b.id);
    await page.getByTestId("api-key-next").click();
    await expectDetails(page, b.name);
    await expectNeighbor(page, "previous", c.id);
    await expectNeighbor(page, "next", a.id);
    await expect
      .poll(async () => {
        const backUrl = new URL(
          (await page.getByTestId("api-key-back").getAttribute("href"))!,
          page.url(),
        );
        const cursor = backUrl.searchParams.get("after");
        return cursor
          ? JSON.parse(Buffer.from(cursor, "base64").toString())
          : null;
      })
      .toMatchObject({
        id: c.id,
        ...(field === "LAST_USED_AT" ? { value: null } : {}),
      });
    await page.getByTestId("api-key-back").click();
    await expect(page.getByRole("row").nth(1)).toContainText(b.name);
    await expect(page.getByRole("row").nth(2)).toContainText(a.name);
    expect(readSearch(page).orderBy).toEqual({ field, direction: "DESC" });
  });
}
