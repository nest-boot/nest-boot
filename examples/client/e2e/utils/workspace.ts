import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";
import { graphqlRequest } from "./graphql";
import type { Page } from "@playwright/test";

export async function createFirstWorkspace(page: Page, name: string) {
  await expect(
    page.getByRole("heading", { name: "Workspaces", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/user\/workspaces\/create$/);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await expect(page.locator("#slug")).toHaveCount(0);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces\/\d+$/);

  return currentWorkspaceId(page);
}

export async function addWorkspaceMemberByApi(
  page: Page,
  workspaceId: string,
  email: string,
) {
  const data = await graphqlRequest<{
    addWorkspaceMember: {
      id: string;
    };
  }>(
    page.request,
    /* GraphQL */ `
      mutation AddWorkspaceMember($input: AddWorkspaceMemberInput!) {
        addWorkspaceMember(input: $input) {
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
      "x-workspace": workspaceId,
    },
  );

  return data.addWorkspaceMember.id;
}

export async function createWorkspaceByApi(page: Page, name: string) {
  const slug = newWorkspaceSlug();
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
    { input: { name, slug } },
  );

  return { id: data.createWorkspace.id, name, slug };
}

function newWorkspaceSlug() {
  return `workspace-${randomUUID().slice(0, 18)}`;
}

function currentWorkspaceId(page: Page) {
  const match = page.url().match(/\/workspaces\/(\d+)/);

  expect(match?.[1]).toBeTruthy();

  return match![1];
}
