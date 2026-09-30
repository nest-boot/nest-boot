import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** PageActions collapses secondary actions into a menu on narrow pages. */
export async function clickPageAction(page: Page, name: string) {
  await expect(page.getByRole("alertdialog")).toBeHidden();
  const actions = page.locator('[data-slot="page-actions"]');
  const button = actions.getByRole("button", { name, exact: true });
  const menu = actions.getByRole("button", {
    name: "More actions",
    exact: true,
  });
  await expect(button.or(menu).first()).toBeVisible();
  if (await button.isVisible()) {
    await button.click();
  } else {
    await menu.click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
}
