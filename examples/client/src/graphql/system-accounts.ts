import { graphql } from "@/gql";

export const SYSTEM_ACCOUNT_PERMISSIONS = graphql(`
  query systemAccountPermissionChoices {
    systemAccountPermissions {
      permission
      grantable
      default
    }
  }
`);
export const SYSTEM_ACCOUNT_DETAILS = graphql(`
  query managedSystemAccount($id: ID!) {
    systemAccount(id: $id) {
      id
      name
      enabled
      permissions
      createdById
      createdAt
    }
  }
`);
export const CREATE_SYSTEM_ACCOUNT = graphql(`
  mutation createManagedSystemAccount($input: CreateSystemAccountInput!) {
    createSystemAccount(input: $input) {
      id
    }
  }
`);
export const UPDATE_SYSTEM_ACCOUNT = graphql(`
  mutation updateManagedSystemAccount(
    $id: ID!
    $input: UpdateSystemAccountInput!
  ) {
    updateSystemAccount(id: $id, input: $input) {
      id
    }
  }
`);
export const DELETE_SYSTEM_ACCOUNT = graphql(`
  mutation deleteManagedSystemAccount($id: ID!) {
    deleteSystemAccount(id: $id) {
      id
    }
  }
`);
export const CREATE_SYSTEM_API_KEY = graphql(`
  mutation createSystemApiKey($input: CreateSystemApiKeyInput!) {
    createSystemApiKey(input: $input) {
      apiKey
      entity {
        id
      }
    }
  }
`);
export const SYSTEM_API_KEY_DETAILS = graphql(`
  query systemApiKey($id: ID!) {
    systemApiKey(id: $id) {
      id
      name
      systemAccount {
        __typename

        id
        name
      }
      revokedAt
      permissions
      prefix
      start
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);
export const UPDATE_SYSTEM_API_KEY = graphql(`
  mutation updateSystemApiKey($id: ID!, $input: UpdateSystemApiKeyInput!) {
    updateSystemApiKey(id: $id, input: $input) {
      id
    }
  }
`);
export const DELETE_SYSTEM_API_KEY = graphql(`
  mutation deleteSystemApiKey($id: ID!) {
    deleteSystemApiKey(id: $id) {
      id
    }
  }
`);

export const SYSTEM_API_KEY_PERMISSIONS = graphql(`
  query systemKeyPermissionChoices($systemAccountId: ID, $apiKeyId: ID) {
    systemApiKeyPermissions(
      systemAccountId: $systemAccountId
      apiKeyId: $apiKeyId
    ) {
      permission
      grantable
      default
    }
  }
`);
export const SYSTEM_API_KEY_ACCOUNTS = graphql(`
  query systemKeyAccountChoices($after: String) {
    systemAccounts(first: 100, after: $after, filter: { enabled: true }) {
      edges {
        node {
          id
          name
          apiKeyPermissions {
            permission
            grantable
            default
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const REVOKE_SYSTEM_API_KEY = graphql(`
  mutation revokeSystemApiKey($id: ID!) {
    revokeSystemApiKey(id: $id) {
      id
      revokedAt
    }
  }
`);
