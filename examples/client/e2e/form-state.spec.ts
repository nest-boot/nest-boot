import { expect, test } from "@playwright/test";

import {
  registerUser,
  signInAsE2eAdministrator,
  testPassword,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

test("validates login fields and retries unchanged values after a server failure", async ({
  page,
}) => {
  let attempts = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/graphql", async (route) => {
    if (!route.request().postData()?.includes("signInFromLoginForm"))
      return route.continue();
    attempts++;
    if (attempts === 1) await pending;
    await route.fulfill({
      json: { errors: [{ message: "Temporary sign-in failure" }] },
    });
  });
  await page.goto("/auth/login");
  const submit = page.getByTestId("auth-submit");
  const email = page.getByTestId("auth-email-input");
  const password = page.getByTestId("auth-password-input");
  await submit.click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toBe(0);

  await email.fill("form-retry@example.com");
  await password.fill(testPassword);
  await password.press("Enter");
  await expect.poll(() => attempts).toBe(1);
  await expect(submit).toBeDisabled();
  await password.press("Enter");
  expect(attempts).toBe(1);
  release?.();
  await expect(
    page.locator("form").getByText("Temporary sign-in failure"),
  ).toBeVisible();
  await expect(submit).toBeEnabled();
  await expect(email).toHaveValue("form-retry@example.com");
  await expect(password).toHaveValue(testPassword);
  await submit.click();
  await expect.poll(() => attempts).toBe(2);
  await expect(submit).toBeEnabled();
});

test("validates matching passwords before submitting a reset and recovers from rejection", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/graphql", async (route) => {
    if (!route.request().postData()?.includes("resetPasswordFromResetPassword"))
      return route.continue();
    attempts++;
    await route.fulfill({
      json:
        attempts === 1
          ? { errors: [{ message: "Temporary password reset failure" }] }
          : { data: { resetPassword: true } },
    });
  });
  await page.goto("/auth/reset-password?token=form-regression-token");
  await page.getByTestId("reset-password-new").fill(testPassword);
  const confirm = page.getByTestId("reset-password-confirm");
  await confirm.fill("a-different-password");
  await confirm.press("Enter");
  await expect(confirm).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("两次输入的密码不一致")).toBeVisible();
  expect(attempts).toBe(0);

  await confirm.fill(testPassword);
  await confirm.press("Enter");
  await expect(
    page.locator("form").getByText("Temporary password reset failure"),
  ).toBeVisible();
  await expect(confirm).toHaveValue(testPassword);
  await page.getByTestId("reset-password-submit").click();
  await expect(page.getByText("密码已重置")).toBeVisible();
  expect(attempts).toBe(2);
});

test("submits administrator forms with Enter and preserves drafts in other cards", async ({
  page,
}) => {
  const email = `${uniqueSeed("admin-form")}@example.com`;
  await signInAsE2eAdministrator(page);
  await page.goto("/admin/users");
  await page.getByRole("link", { name: "创建用户", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users\/create$/);
  await page.reload();
  const createPage = page.getByTestId("admin-create-user-page");
  await expect(createPage).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const breadcrumbs = createPage.getByRole("navigation", {
    name: "面包屑导航",
  });
  await expect(breadcrumbs.getByRole("link")).toHaveCount(1);
  await breadcrumbs.getByRole("link", { name: "用户", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await page.goto("/admin/users/create");
  let attempts = 0;
  await page.route("**/api/graphql", async (route) => {
    if (!route.request().postData()?.includes("createUserFromCreateUserRoute"))
      return route.continue();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        json: { errors: [{ message: "Temporary creation failure" }] },
      });
    return route.continue();
  });
  await page.getByTestId("admin-create-user-submit").click();
  await expect(
    createPage.getByText("请输入姓名", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(0);
  await createPage.getByLabel("名称", { exact: true }).fill("Form target");
  await createPage.getByLabel("邮箱", { exact: true }).fill(email);
  const password = createPage.getByLabel("临时密码");
  await password.fill(testPassword);
  await password.press("Enter");
  await expect(
    createPage.getByText("Temporary creation failure", { exact: true }),
  ).toBeVisible();
  await expect(password).toHaveValue(testPassword);
  await expect(createPage.getByLabel("邮箱", { exact: true })).toHaveValue(
    email,
  );
  const created = page.waitForResponse(
    (response) =>
      response
        .request()
        .postData()
        ?.includes("createUserFromCreateUserRoute") === true,
  );
  await page.getByTestId("admin-create-user-submit").click();
  const result = await (await created).json();
  expect(result.errors).toBeUndefined();
  const id = result.data.createUser.id;
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();
  expect(attempts).toBe(2);

  await page.goto(`/admin/users/${id}`);
  const name = page.getByTestId("admin-user-name");
  await expect(name).toHaveValue("Form target");
  await name.fill("Unsaved profile draft");
  await page.getByTestId("user-role-ADMIN").check();
  const rolesSaved = page.waitForResponse(
    (response) =>
      response.request().postData()?.includes("setUserRolesFromUserRoute") ===
      true,
  );
  await page.getByTestId("admin-user-roles-save").click();
  await rolesSaved;
  await expect(page.getByTestId("admin-user-roles-save")).toBeEnabled();
  await expect(name).toHaveValue("Unsaved profile draft");
  await expect(
    page.getByRole("heading", { name: "Form target", exact: true }),
  ).toBeVisible();

  await name.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Unsaved profile draft", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(name).toHaveValue("Unsaved profile draft");
  await expect(page.getByTestId("user-role-ADMIN")).toBeChecked();
});

test("cancels account deletion without losing input and retries after a failed password", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("delete-form")}@example.com`,
    name: "Delete form user",
  });
  await page.goto("/user/security");
  const card = page.getByTestId("user-delete-card");
  const password = card.getByLabel("当前密码");
  const submit = page.getByTestId("user-delete-account");
  await password.fill("incorrect-password");
  await password.press("Enter");
  await expect(page.getByTestId("alert-dialog")).toBeVisible();
  await page.getByTestId("alert-dialog-cancel").click();
  await expect(submit).toBeEnabled();
  await expect(password).toHaveValue("incorrect-password");
  await submit.click();
  await page.getByTestId("alert-dialog-confirm").click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(submit).toBeEnabled();
  await expect(password).toHaveValue("incorrect-password");
  const { currentUser } = await graphqlRequest<{ currentUser: { id: string } }>(
    page.request,
    "query { currentUser { id } }",
  );
  expect(currentUser.id).toBeTruthy();

  await password.fill(testPassword);
  await submit.click();
  await page.getByTestId("alert-dialog-confirm").click();
  await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
});
