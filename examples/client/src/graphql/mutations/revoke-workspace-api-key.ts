import { graphql } from "@/gql";

export const REVOKE_WORKSPACE_API_KEY = graphql(`
  mutation revokeWorkspaceApiKeyFromApiKeysRoute($id: ID!) {
    revokeWorkspaceApiKey(id: $id) {
      id
      revokedAt
    }
  }
`);
