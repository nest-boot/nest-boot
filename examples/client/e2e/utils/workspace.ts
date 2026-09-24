import { expect } from "@playwright/test";
import { graphqlRequest } from "./graphql";
import type { Page } from "@playwright/test";

export async function createFirstWorkspace(page: Page, name: string) {
  await expect(
    page.getByRole("heading", { name: "Workspaces", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/user\/workspaces\/create$/);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces\/\d+$/);

  return currentWorkspaceId(page);
}

export async function addMemberByApi(
  page: Page,
  workspaceId: string,
  email: string,
) {
  const data = await graphqlRequest<{
    addMember: {
      id: string;
    };
  }>(
    page.request,
    /* GraphQL */ `
      mutation AddMember($input: AddMemberInput!) {
        addMember(input: $input) {
          id
        }
      }
    `,
    {
      input: {
        email,
      },
    },
    {
      "x-workspace-id": workspaceId,
    },
  );

  return data.addMember.id;
}

export async function createWorkspaceByApi(page: Page, name: string) {
  const data = await graphqlRequest<{
    createWorkspace: {
      id: string;
    };
  }>(
    page.request,
    /* GraphQL */ `
      mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) {
          id
        }
      }
    `,
    { input: { name } },
  );

  return { id: data.createWorkspace.id, name };
}

function currentWorkspaceId(page: Page) {
  const match = page.url().match(/\/workspaces\/(\d+)/);

  expect(match?.[1]).toBeTruthy();

  return match![1];
}
