import { expect, test } from "@playwright/test";
import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";

test("wide tables scroll inside their cards and keep pagination visible", async ({
  page,
}) => {
  const seed = uniqueSeed("table-scroll");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Table scroll owner",
  });
  await page.setViewportSize({ width: 390, height: 800 });

  const area = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: page.getByRole("table") });
  const viewport = area.locator('[data-slot="scroll-area-viewport"]');
  const next = page.getByRole("button", { name: "Next page", exact: true });
  const scrollbar = area.locator(
    '[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]',
  );

  const scrollTable = async () => {
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollWidth > el.clientWidth))
      .toBe(true);
    await expect(area.locator('[data-slot="table-container"]')).toHaveCSS(
      "overflow-x",
      "visible",
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const nextX = (await next.boundingBox())!.x;
    await viewport.hover();
    await expect(scrollbar).toBeVisible();
    const thumb = scrollbar.locator('[data-slot="scroll-area-thumb"]');
    const box = (await thumb.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    expect((await next.boundingBox())!.x).toBeCloseTo(nextX, 0);
    expect(
      await viewport.evaluate(
        (el) => el.querySelector('button[aria-label="Next page"]') === null,
      ),
    ).toBe(true);
    expect(
      await area
        .locator('[data-slot="table-container"]')
        .evaluate((el) => el.scrollLeft),
    ).toBe(0);
    // Pinned cells must not intercept pointer events on either end of the track.
    expect(
      await scrollbar.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return [rect.left + 3, rect.right - 3].every((x) =>
          el.contains(document.elementFromPoint(x, rect.top + rect.height / 2)),
        );
      }),
    ).toBe(true);
  };

  await expect(page.getByText("No items found", { exact: true })).toBeVisible();
  await scrollTable();
  const workspace = await createWorkspaceByApi(page, seed);
  await page.reload();
  await expect(
    page.getByRole("link", { name: seed, exact: true }),
  ).toBeVisible();
  await scrollTable();

  await page.goto(`/workspaces/${workspace.id}/members`);
  await expect(
    page.getByRole("button", { name: "Open row actions", exact: true }),
  ).toHaveCount(0);
  await scrollTable();
  await page
    .getByRole("cell", { name: "Table scroll owner", exact: false })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${workspace.id}/members/[^/]+$`),
  );
});
