import { graphql } from "@/gql";

export const REVOKE_USER_API_KEY = graphql(`
  mutation revokeUserApiKey($id: ID!) {
    revokeUserApiKey(id: $id) {
      id
      revokedAt
    }
  }
`);
