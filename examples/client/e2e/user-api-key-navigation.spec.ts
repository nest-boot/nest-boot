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
  await page.getByTestId("api-key-previous").click();
  await expectDetails(page, b.name);
  await expectNeighbor(page, "previous", a.id);
  await page.getByTestId("api-key-previous").click();
  await expectDetails(page, a.name);
  await expectNeighbor(page, "next", b.id);
  await expect(page.getByTestId("api-key-previous")).toBeDisabled();
  await page.goBack();
  await expectDetails(page, b.name);
  await page.goBack();
  await expectDetails(page, c.name);
  await page.reload();
  await expectNeighbor(page, "previous", b.id);
  await page.getByTestId("api-key-next").click();
  await expectDetails(page, d.name);
  await expectNeighbor(page, "previous", c.id);
  await expect(page.getByTestId("api-key-next")).toBeDisabled();
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
  const [a, b, c] = await prepareKeys(page);
  await page.goto(listPath());
  await expect(
    page.getByRole("link", { name: a.name, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("page-search:v1:"),
    )!;
    sessionStorage.setItem(key, "broken json");
  });
  await page.goto(`/user/api-keys/${b.id}`);
  await expectDetails(page, b.name);
  // Direct-entry defaults are CREATED_AT DESC, not the previous ascending search.
  await expectNeighbor(page, "previous", c.id);
  await expectNeighbor(page, "next", a.id);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("page-search:v1:"),
      ),
    ),
  ).toEqual([]);
  await page.goto(listPath());
  await expect(
    page.getByRole("link", { name: b.name, exact: true }),
  ).toBeVisible();
  let fail = true;
  await page.route("**/api/graphql", async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string };
    if (body.operationName === "getUserApiKeyNeighbors" && fail) {
      await route.fulfill({
        json: { errors: [{ message: "Simulated neighbor failure" }] },
      });
    } else await route.continue();
  });
  await page.getByRole("link", { name: b.name, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("无法加载相邻 API 密钥");
  await expect(page.getByTestId("api-key-previous")).toBeDisabled();
  await expect(page.getByTestId("api-key-next")).toBeDisabled();
  const fallback = new URL(
    (await page.getByTestId("api-key-back").getAttribute("href"))!,
    page.url(),
  );
  expect(fallback.searchParams.get("query")).toBe(query);
  expect(fallback.searchParams.get("after")).toBeNull();
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expectNeighbor(page, "previous", a.id);
  await expectNeighbor(page, "next", c.id);
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
    const backUrl = new URL(
      (await page.getByTestId("api-key-back").getAttribute("href"))!,
      page.url(),
    );
    const cursor = JSON.parse(
      Buffer.from(backUrl.searchParams.get("after")!, "base64").toString(),
    );
    expect(cursor.id).toBe(c.id);
    if (field === "LAST_USED_AT") expect(cursor.value).toBeNull();
    await page.getByTestId("api-key-back").click();
    await expect(page.getByRole("row").nth(1)).toContainText(b.name);
    await expect(page.getByRole("row").nth(2)).toContainText(a.name);
    expect(readSearch(page).orderBy).toEqual({ field, direction: "DESC" });
  });
}
