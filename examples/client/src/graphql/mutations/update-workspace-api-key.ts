import { graphql } from "@/gql";

export const UPDATE_WORKSPACE_API_KEY = graphql(`
  mutation updateWorkspaceApiKeyFromApiKeysRoute(
    $id: ID!
    $input: UpdateWorkspaceApiKeyInput!
  ) {
    updateWorkspaceApiKey(id: $id, input: $input) {
      workspaceId
      id
      name
      start
      prefix
      enabled
      permissions
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);
