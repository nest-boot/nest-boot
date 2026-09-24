import { graphql } from "@/gql";

export const GET_ADMIN_USER_NEIGHBORS = graphql(`
  query getAdminUserNeighbors(
    $cursor: String!
    $query: String
    $filter: UserFilter
    $orderBy: UserOrder
  ) {
    previous: users(
      last: 1
      before: $cursor
      query: $query
      filter: $filter
      orderBy: $orderBy
    ) {
      edges {
        cursor
        node {
          id
        }
      }
    }
    next: users(
      first: 1
      after: $cursor
      query: $query
      filter: $filter
      orderBy: $orderBy
    ) {
      edges {
        cursor
        node {
          id
        }
      }
    }
  }
`);

export const GET_MEMBER_NEIGHBORS = graphql(`
  query getMemberNeighbors(
    $cursor: String!
    $query: String
    $filter: MemberFilter
    $orderBy: MemberOrder
  ) {
    currentWorkspace {
      id
      previous: members(
        last: 1
        before: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
      next: members(
        first: 1
        after: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
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

export const GET_WORKSPACE_NEIGHBORS = graphql(`
  query getWorkspaceNeighbors(
    $cursor: String!
    $query: String
    $filter: WorkspaceFilter
    $orderBy: WorkspaceOrder
  ) {
    currentUser {
      id
      previous: workspaces(
        last: 1
        before: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
      next: workspaces(
        first: 1
        after: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
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
