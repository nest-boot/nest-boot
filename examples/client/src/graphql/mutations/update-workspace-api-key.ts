import { graphql } from "@/gql";

export const UPDATE_WORKSPACE_API_KEY = graphql(`
  mutation updateWorkspaceApiKey(
    $id: ID!
    $input: UpdateWorkspaceApiKeyInput!
  ) {
    updateWorkspaceApiKey(id: $id, input: $input) {
      id
      name
      start
      prefix
      revokedAt
      permissions
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);
