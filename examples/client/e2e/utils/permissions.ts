import labels from "../../public/locales/en/permission.json" with { type: "json" };
import type { Page } from "@playwright/test";

export function getPermissionCheckbox(page: Page, permission: string) {
  const key = permission.toLowerCase().replaceAll("__", "_");
  const label = (labels as Record<string, string | { name: string }>)[key];
  if (!label || typeof label === "string") {
    throw new Error(`Missing English permission label: ${permission}`);
  }
  return page.getByRole("checkbox", { name: label.name, exact: true });
}
