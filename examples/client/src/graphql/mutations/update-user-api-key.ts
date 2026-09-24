import { graphql } from "@/gql";

export const UPDATE_USER_API_KEY = graphql(`
  mutation updateUserApiKeyFromUserApiKeysRoute(
    $id: ID!
    $input: UpdateUserApiKeyInput!
  ) {
    updateUserApiKey(id: $id, input: $input) {
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
