import { graphql } from "@/gql";

export const GET_WORKSPACE_API_KEY_NEIGHBORS = graphql(`
  query getWorkspaceApiKeyNeighbors(
    $cursor: String!
    $filter: WorkspaceApiKeyFilter
    $orderBy: WorkspaceApiKeyOrder
    $query: String
  ) {
    currentWorkspace {
      id
      previous: apiKeys(
        last: 1
        before: $cursor
        filter: $filter
        orderBy: $orderBy
        query: $query
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
      next: apiKeys(
        first: 1
        after: $cursor
        filter: $filter
        orderBy: $orderBy
        query: $query
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
    }
  }
`);

export const GET_USER_API_KEY_NEIGHBORS = graphql(`
  query getUserApiKeyNeighbors(
    $cursor: String!
    $filter: UserApiKeyFilter
    $orderBy: UserApiKeyOrder
    $query: String
  ) {
    currentUser {
      id
      previous: apiKeys(
        last: 1
        before: $cursor
        filter: $filter
        orderBy: $orderBy
        query: $query
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
      next: apiKeys(
        first: 1
        after: $cursor
        filter: $filter
        orderBy: $orderBy
        query: $query
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
    }
  }
`);

export const GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE = graphql(`
  query getUserApiKeysFromUserApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: UserApiKeyFilter
    $orderBy: UserApiKeyOrder
    $query: String
  ) {
    currentUser {
      apiKeys(
        after: $after
        before: $before
        first: $first
        last: $last
        orderBy: $orderBy
        filter: $filter
        query: $query
      ) {
        edges {
          node {
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
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
      }
    }
  }
`);

export const CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation createUserApiKeyFromUserApiKeysRoute(
    $input: CreateUserApiKeyInput!
  ) {
    createUserApiKey(input: $input) {
      apiKey
      entity {
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
  }
`);

export const UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
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

export const DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {
    deleteUserApiKey(id: $id) {
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

export const GET_API_KEYS_FROM_API_KEYS_ROUTE = graphql(`
  query getApiKeysFromApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: WorkspaceApiKeyFilter
    $orderBy: WorkspaceApiKeyOrder
    $query: String
  ) {
    currentWorkspace {
      apiKeys(
        after: $after
        before: $before
        first: $first
        last: $last
        orderBy: $orderBy
        filter: $filter
        query: $query
      ) {
        edges {
          node {
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
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
      }
    }
  }
`);

export const CREATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation createWorkspaceApiKeyFromApiKeysRoute(
    $input: CreateWorkspaceApiKeyInput!
  ) {
    createWorkspaceApiKey(input: $input) {
      apiKey
      entity {
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
  }
`);

export const UPDATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
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

export const DELETE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {
    deleteWorkspaceApiKey(id: $id) {
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

export const GET_USER_API_KEY_OPTIONS = graphql(`
  query getUserApiKeyOptions {
    userApiKeyPermissions {
      permission
      grantable
      default
    }
  }
`);
export const GET_USER_API_KEY = graphql(`
  query getUserApiKeyDetails($id: ID!) {
    userApiKeyPermissions {
      permission
      grantable
      default
    }
    currentUser {
      apiKey(id: $id) {
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
  }
`);

export const GET_WORKSPACE_API_KEY_OPTIONS = graphql(`
  query getWorkspaceApiKeyOptions {
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
  }
`);
export const GET_WORKSPACE_API_KEY = graphql(`
  query getWorkspaceApiKeyDetails($id: ID!) {
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
    currentWorkspace {
      apiKey(id: $id) {
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
  }
`);
