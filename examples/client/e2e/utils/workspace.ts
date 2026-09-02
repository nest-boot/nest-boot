import { expect } from "@playwright/test";
import { graphqlRequest } from "./graphql";
import type { Page } from "@playwright/test";

export async function createFirstWorkspace(page: Page, name: string) {
  await expect(page.getByTestId("workspace-empty-state")).toBeVisible();
  await page.getByTestId("workspace-create-name-input").fill(name);
  await page.getByTestId("workspace-create-submit").click();
  await expect(page).toHaveURL(/\/workspaces\/\d+\/settings$/);

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
      "x-workspace-id": workspaceId,
    },
  );

  return data.addWorkspaceMember.id;
}

function currentWorkspaceId(page: Page) {
  const match = page.url().match(/\/workspaces\/(\d+)/);

  expect(match?.[1]).toBeTruthy();

  return match![1];
}
