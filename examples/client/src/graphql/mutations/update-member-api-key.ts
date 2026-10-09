import { graphql } from "@/gql";

export const UPDATE_MEMBER_API_KEY = graphql(`
  mutation updateMemberApiKeyFromApiKeysRoute(
    $id: ID!
    $input: UpdateMemberApiKeyInput!
  ) {
    updateMemberApiKey(id: $id, input: $input) {
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
