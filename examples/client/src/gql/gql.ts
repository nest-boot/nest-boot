/* eslint-disable */
import * as types from "./graphql";
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  "\n  query systemApiKeys(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemApiKeyFilter\n    $orderBy: SystemApiKeyOrder\n  ) {\n    systemApiKeys(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          systemAccount {\n            __typename\n\n            id\n            name\n          }\n          revokedAt\n          permissions\n          prefix\n          start\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": typeof types.SystemApiKeysDocument;
  "\n  query getAdminOverview($includeUsers: Boolean! = true) {\n    users(first: 1) @include(if: $includeUsers) {\n      totalCount\n      totalCountRelation\n    }\n  }\n": typeof types.GetAdminOverviewDocument;
  "\n  query getAdminSystemAccountOverview {\n    systemAccounts(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n": typeof types.GetAdminSystemAccountOverviewDocument;
  "\n  query getAdminSystemKeyOverview {\n    systemApiKeys(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n": typeof types.GetAdminSystemKeyOverviewDocument;
  "\n  query managedSystemAccounts(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemAccountFilter\n    $orderBy: SystemAccountOrder\n  ) {\n    systemAccounts(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          enabled\n          permissions\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n": typeof types.ManagedSystemAccountsDocument;
  "\n  query getAdminUserNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: UserFilter\n    $orderBy: UserOrder\n  ) {\n    previous: users(\n      last: 1\n      before: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: users(\n      first: 1\n      after: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n": typeof types.GetAdminUserNeighborsDocument;
  "\n  query getUserFromUserRoute(\n    $id: ID!\n    $sessionsAfter: String\n    $includeSessions: Boolean! = false\n    $includeRoles: Boolean! = false\n    $includePermissions: Boolean! = false\n  ) {\n    user(id: $id) {\n      id\n      name\n      email\n      emailVerified\n      image\n      roles\n      permissions\n      banned\n      banReason\n      banExpiresAt\n      createdAt\n      updatedAt\n      sessions(\n        first: 20\n        after: $sessionsAfter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeSessions) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n    userRoles @include(if: $includeRoles) {\n      role\n      grantable\n    }\n    userPermissions @include(if: $includePermissions) {\n      permission\n      grantable\n    }\n  }\n": typeof types.GetUserFromUserRouteDocument;
  "\n  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateManagedUserFromUserRouteDocument;
  "\n  mutation setUserPermissionsFromUserRoute(\n    $id: ID!\n    $input: SetUserPermissionsInput!\n  ) {\n    setUserPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetUserPermissionsFromUserRouteDocument;
  "\n  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {\n    setUserRoles(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetUserRolesFromUserRouteDocument;
  "\n  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {\n    banUser(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.BanUserFromUserRouteDocument;
  "\n  mutation unbanUserFromUserRoute($id: ID!) {\n    unbanUser(id: $id) {\n      id\n    }\n  }\n": typeof types.UnbanUserFromUserRouteDocument;
  "\n  mutation setUserPasswordFromUserRoute(\n    $id: ID!\n    $input: SetUserPasswordInput!\n  ) {\n    setUserPassword(id: $id, input: $input)\n  }\n": typeof types.SetUserPasswordFromUserRouteDocument;
  "\n  mutation revokeUserSessionFromUserRoute($userId: ID!, $id: ID!) {\n    revokeSession(userId: $userId, id: $id)\n  }\n": typeof types.RevokeUserSessionFromUserRouteDocument;
  "\n  mutation revokeUserSessionsFromUserRoute($userId: ID!) {\n    revokeUserSessions(userId: $userId)\n  }\n": typeof types.RevokeUserSessionsFromUserRouteDocument;
  "\n  mutation deleteUserFromUserRoute($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteUserFromUserRouteDocument;
  "\n  mutation impersonateUserFromUserRoute($id: ID!) {\n    impersonateUser(id: $id) {\n      id\n    }\n  }\n": typeof types.ImpersonateUserFromUserRouteDocument;
  "\n  mutation createUserFromCreateUserRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateUserFromCreateUserRouteDocument;
  "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": typeof types.GetUsersFromUsersRouteDocument;
  "\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n": typeof types.SignOutFromSidebarUserDocument;
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n": typeof types.GetWorkspacesFromWorkspaceSwitcherDocument;
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n": typeof types.GetCurrentUserFromAuthenticatedRouteDocument;
  "\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n": typeof types.StopImpersonatingFromAuthenticatedRouteDocument;
  "\n  mutation deleteUserApiKey($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteUserApiKeyDocument;
  "\n  query getUserApiKeyDetails($id: ID!) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKey(id: $id) {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.GetUserApiKeyDetailsDocument;
  "\n  query getUserApiKeyNeighbors(\n    $cursor: String!\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      id\n      previous: apiKeys(\n        last: 1\n        before: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: apiKeys(\n        first: 1\n        after: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetUserApiKeyNeighborsDocument;
  "\n  mutation createUserApiKey($input: CreateUserApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateUserApiKeyDocument;
  "\n  query getUserApiKeyOptions {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n": typeof types.GetUserApiKeyOptionsDocument;
  "\n  query getUserApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            revokedAt\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n": typeof types.GetUserApiKeysDocument;
  "\n  query getUserOverview($includeApiKeys: Boolean!) {\n    currentUser {\n      id\n      workspaces(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      sessions(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      apiKeys(first: 1) @include(if: $includeApiKeys) {\n        totalCount\n        totalCountRelation\n      }\n    }\n  }\n": typeof types.GetUserOverviewDocument;
  "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    updateCurrentUser(input: $input)\n  }\n": typeof types.UpdateUserFromUserRouteDocument;
  "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    changeCurrentUserEmail(input: $input)\n  }\n": typeof types.ChangeEmailFromUserRouteDocument;
  "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    changeCurrentUserPassword(input: $input) {\n      token\n    }\n  }\n": typeof types.ChangePasswordFromUserSecurityDocument;
  "\n  query getSessionsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      sessions(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            current\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetSessionsFromUserSecurityDocument;
  "\n  mutation revokeSessionFromUserSecurity($id: ID!) {\n    revokeCurrentUserSession(id: $id)\n  }\n": typeof types.RevokeSessionFromUserSecurityDocument;
  "\n  mutation revokeOtherSessionsFromUserSecurity {\n    revokeCurrentUserOtherSessions\n  }\n": typeof types.RevokeOtherSessionsFromUserSecurityDocument;
  "\n  query getAccountsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      accounts(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        totalCount\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            accountId\n            issuer\n            providerId\n            scopes\n            createdAt\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetAccountsFromUserSecurityDocument;
  "\n  query getSocialProvidersFromUserSecurity {\n    socialProviders {\n      id\n      name\n    }\n  }\n": typeof types.GetSocialProvidersFromUserSecurityDocument;
  "\n  mutation unlinkAccountFromUserSecurity($id: ID!) {\n    unlinkCurrentUserAccount(id: $id)\n  }\n": typeof types.UnlinkAccountFromUserSecurityDocument;
  "\n  mutation linkAccountFromUserSecurity($input: AuthLinkSocialAccountInput!) {\n    linkCurrentUserAccount(input: $input) {\n      url\n      redirect\n    }\n  }\n": typeof types.LinkAccountFromUserSecurityDocument;
  "\n  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {\n    deleteCurrentUser(input: $input) {\n      success\n      message\n    }\n  }\n": typeof types.DeleteUserFromUserSecurityDocument;
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceFromCreateWorkspaceRouteDocument;
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $query: String\n    $filter: WorkspaceFilter\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        query: $query\n        filter: $filter\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n": typeof types.GetWorkspacesFromUserWorkspacesRouteDocument;
  "\n  mutation acceptWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.AcceptWorkspaceInvitationFromUserWorkspacesRouteDocument;
  "\n  mutation rejectWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.RejectWorkspaceInvitationFromUserWorkspacesRouteDocument;
  "\n  mutation deleteWorkspaceApiKey($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteWorkspaceApiKeyDocument;
  "\n  query getWorkspaceApiKeyDetails($id: ID!) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    selectedWorkspace {\n      apiKey(id: $id) {\n        member {\n          __typename\n\n          id\n          name\n        }\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.GetWorkspaceApiKeyDetailsDocument;
  "\n  query getWorkspaceApiKeyNeighbors(\n    $cursor: String!\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    selectedWorkspace {\n      id\n    }\n    previous: workspaceApiKeys(\n      last: 1\n      before: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: workspaceApiKeys(\n      first: 1\n      after: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n": typeof types.GetWorkspaceApiKeyNeighborsDocument;
  "\n  mutation createWorkspaceApiKey($input: CreateWorkspaceApiKeyInput!) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateWorkspaceApiKeyDocument;
  "\n  query getWorkspaceApiKeyOptions(\n    $includeWorkspaceMembers: Boolean! = false\n    $after: String\n    $memberFilter: WorkspaceMemberFilter\n  ) {\n    selectedWorkspace @include(if: $includeWorkspaceMembers) {\n      members(first: 100, after: $after, filter: $memberFilter) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n": typeof types.GetWorkspaceApiKeyOptionsDocument;
  "\n  query getWorkspaceApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          member {\n            __typename\n\n            id\n            name\n            type\n            workspaceId\n          }\n          name\n          start\n          prefix\n          revokedAt\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n": typeof types.GetWorkspaceApiKeysDocument;
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentWorkspaceMember {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n": typeof types.GetCurrentWorkspaceFromWorkspaceLayoutDocument;
  "\n  mutation setWorkspaceMemberPermissionsFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberPermissionsInput!\n  ) {\n    setWorkspaceMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteDocument;
  "\n  mutation updateWorkspaceMemberFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateWorkspaceMemberFromWorkspaceMemberRouteDocument;
  "\n  mutation setWorkspaceMemberRolesFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberRolesInput!\n  ) {\n    setWorkspaceMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetWorkspaceMemberRolesFromWorkspaceMemberRouteDocument;
  "\n  query getWorkspaceMemberNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n  ) {\n    selectedWorkspace {\n      id\n      previous: members(\n        last: 1\n        before: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: members(\n        first: 1\n        after: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetWorkspaceMemberNeighborsDocument;
  "\n  query getWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n      createdAt\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n": typeof types.GetWorkspaceMemberFromWorkspaceMemberRouteDocument;
  "\n  mutation removeWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n": typeof types.RemoveWorkspaceMemberFromWorkspaceMemberRouteDocument;
  "\n  mutation updateWorkspaceMemberStatusFromWorkspaceMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteDocument;
  "\n  query getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n": typeof types.GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteDocument;
  "\n  query getRolesFromInviteWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n": typeof types.GetRolesFromInviteWorkspaceMemberRouteDocument;
  "\n  mutation createWorkspaceInvitationFromInviteWorkspaceMemberRoute(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteDocument;
  "\n  query getWorkspaceMembersFromWorkspaceMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: WorkspaceInvitationFilter\n    $includeWorkspaceInvitations: Boolean! = false\n  ) {\n    selectedWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            type\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    selectedWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeWorkspaceInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n": typeof types.GetWorkspaceMembersFromWorkspaceMembersRouteDocument;
  "\n  mutation cancelWorkspaceInvitationFromWorkspaceMembersRoute($id: ID!) {\n    cancelWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.CancelWorkspaceInvitationFromWorkspaceMembersRouteDocument;
  "\n  query getWorkspaceOverview(\n    $workspaceId: ID!\n    $includeWorkspaceMembers: Boolean!\n    $includeApiKeys: Boolean!\n  ) {\n    workspace(id: $workspaceId) {\n      id\n      members(first: 1) @include(if: $includeWorkspaceMembers) {\n        totalCount\n        totalCountRelation\n      }\n    }\n    workspaceApiKeys(first: 1) @include(if: $includeApiKeys) {\n      totalCount\n      totalCountRelation\n    }\n  }\n": typeof types.GetWorkspaceOverviewDocument;
  "\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateWorkspaceFromSettingsRouteDocument;
  "\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkspaceFromSettingsRouteDocument;
  "\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n": typeof types.LeaveWorkspaceFromSettingsRouteDocument;
  "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    currentUser {\n      workspaces(first: 1) {\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetFirstWorkspaceFromWorkspacesRouteDocument;
  "\n  mutation signInFromLoginForm($input: AuthSignInInput!) {\n    signIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n": typeof types.SignInFromLoginFormDocument;
  "\n  mutation signUpFromLoginForm($input: AuthSignUpInput!) {\n    signUp(input: $input) {\n      id\n    }\n  }\n": typeof types.SignUpFromLoginFormDocument;
  "\n  query getSocialProvidersFromLoginForm {\n    socialProviders {\n      id\n      name\n    }\n  }\n": typeof types.GetSocialProvidersFromLoginFormDocument;
  "\n  mutation signInSocialFromLoginForm($input: AuthSignInSocialInput!) {\n    signInSocial(input: $input) {\n      redirect\n      url\n    }\n  }\n": typeof types.SignInSocialFromLoginFormDocument;
  "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    requestPasswordReset(input: $input) {\n      status\n    }\n  }\n": typeof types.RequestPasswordResetFromForgotPasswordDocument;
  "\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n": typeof types.GetCurrentUserFromAuthLayoutDocument;
  "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    resetPassword(input: $input)\n  }\n": typeof types.ResetPasswordFromResetPasswordDocument;
  "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    sendVerificationEmail(input: $input)\n  }\n": typeof types.SendVerificationEmailFromVerifyEmailDocument;
  "\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n": typeof types.GetCurrentUserFromInviteRouteDocument;
  "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n": typeof types.GetWorkspaceInvitationFromInviteRouteDocument;
  "\n  mutation acceptWorkspaceInvitationFromInviteRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n": typeof types.AcceptWorkspaceInvitationFromInviteRouteDocument;
  "\n  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(\n    $input: AddWorkspaceMemberInput!\n  ) {\n    addWorkspaceMember(input: $input) {\n      id\n    }\n  }\n": typeof types.AddWorkspaceServiceAccountFromWorkspaceMembersRouteDocument;
  "\n  mutation revokeUserApiKey($id: ID!) {\n    revokeUserApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n": typeof types.RevokeUserApiKeyDocument;
  "\n  mutation revokeWorkspaceApiKey($id: ID!) {\n    revokeWorkspaceApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n": typeof types.RevokeWorkspaceApiKeyDocument;
  "\n  mutation updateUserApiKey($id: ID!, $input: UpdateUserApiKeyInput!) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateUserApiKeyDocument;
  "\n  mutation updateWorkspaceApiKey(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateWorkspaceApiKeyDocument;
  "\n  query systemAccountPermissionChoices {\n    systemAccountPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n": typeof types.SystemAccountPermissionChoicesDocument;
  "\n  query managedSystemAccount($id: ID!) {\n    systemAccount(id: $id) {\n      id\n      name\n      enabled\n      permissions\n      createdById\n      createdAt\n    }\n  }\n": typeof types.ManagedSystemAccountDocument;
  "\n  mutation createManagedSystemAccount($input: CreateSystemAccountInput!) {\n    createSystemAccount(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateManagedSystemAccountDocument;
  "\n  mutation updateManagedSystemAccount(\n    $id: ID!\n    $input: UpdateSystemAccountInput!\n  ) {\n    updateSystemAccount(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateManagedSystemAccountDocument;
  "\n  mutation deleteManagedSystemAccount($id: ID!) {\n    deleteSystemAccount(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteManagedSystemAccountDocument;
  "\n  mutation createSystemApiKey($input: CreateSystemApiKeyInput!) {\n    createSystemApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n      }\n    }\n  }\n": typeof types.CreateSystemApiKeyDocument;
  "\n  query systemApiKey($id: ID!) {\n    systemApiKey(id: $id) {\n      id\n      name\n      systemAccount {\n        __typename\n\n        id\n        name\n      }\n      revokedAt\n      permissions\n      prefix\n      start\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.SystemApiKeyDocument;
  "\n  mutation updateSystemApiKey($id: ID!, $input: UpdateSystemApiKeyInput!) {\n    updateSystemApiKey(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateSystemApiKeyDocument;
  "\n  mutation deleteSystemApiKey($id: ID!) {\n    deleteSystemApiKey(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteSystemApiKeyDocument;
  "\n  query systemKeyPermissionChoices($systemAccountId: ID, $apiKeyId: ID) {\n    systemApiKeyPermissions(\n      systemAccountId: $systemAccountId\n      apiKeyId: $apiKeyId\n    ) {\n      permission\n      grantable\n      default\n    }\n  }\n": typeof types.SystemKeyPermissionChoicesDocument;
  "\n  query systemKeyAccountChoices($after: String) {\n    systemAccounts(first: 100, after: $after, filter: { enabled: true }) {\n      edges {\n        node {\n          id\n          name\n          apiKeyPermissions {\n            permission\n            grantable\n            default\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n": typeof types.SystemKeyAccountChoicesDocument;
  "\n  mutation revokeSystemApiKey($id: ID!) {\n    revokeSystemApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n": typeof types.RevokeSystemApiKeyDocument;
  "\n  query getPasswordPolicy {\n    passwordPolicy {\n      minLength\n      maxLength\n    }\n  }\n": typeof types.GetPasswordPolicyDocument;
};
const documents: Documents = {
  "\n  query systemApiKeys(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemApiKeyFilter\n    $orderBy: SystemApiKeyOrder\n  ) {\n    systemApiKeys(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          systemAccount {\n            __typename\n\n            id\n            name\n          }\n          revokedAt\n          permissions\n          prefix\n          start\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n":
    types.SystemApiKeysDocument,
  "\n  query getAdminOverview($includeUsers: Boolean! = true) {\n    users(first: 1) @include(if: $includeUsers) {\n      totalCount\n      totalCountRelation\n    }\n  }\n":
    types.GetAdminOverviewDocument,
  "\n  query getAdminSystemAccountOverview {\n    systemAccounts(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n":
    types.GetAdminSystemAccountOverviewDocument,
  "\n  query getAdminSystemKeyOverview {\n    systemApiKeys(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n":
    types.GetAdminSystemKeyOverviewDocument,
  "\n  query managedSystemAccounts(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemAccountFilter\n    $orderBy: SystemAccountOrder\n  ) {\n    systemAccounts(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          enabled\n          permissions\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n":
    types.ManagedSystemAccountsDocument,
  "\n  query getAdminUserNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: UserFilter\n    $orderBy: UserOrder\n  ) {\n    previous: users(\n      last: 1\n      before: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: users(\n      first: 1\n      after: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n":
    types.GetAdminUserNeighborsDocument,
  "\n  query getUserFromUserRoute(\n    $id: ID!\n    $sessionsAfter: String\n    $includeSessions: Boolean! = false\n    $includeRoles: Boolean! = false\n    $includePermissions: Boolean! = false\n  ) {\n    user(id: $id) {\n      id\n      name\n      email\n      emailVerified\n      image\n      roles\n      permissions\n      banned\n      banReason\n      banExpiresAt\n      createdAt\n      updatedAt\n      sessions(\n        first: 20\n        after: $sessionsAfter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeSessions) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n    userRoles @include(if: $includeRoles) {\n      role\n      grantable\n    }\n    userPermissions @include(if: $includePermissions) {\n      permission\n      grantable\n    }\n  }\n":
    types.GetUserFromUserRouteDocument,
  "\n  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateManagedUserFromUserRouteDocument,
  "\n  mutation setUserPermissionsFromUserRoute(\n    $id: ID!\n    $input: SetUserPermissionsInput!\n  ) {\n    setUserPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetUserPermissionsFromUserRouteDocument,
  "\n  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {\n    setUserRoles(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetUserRolesFromUserRouteDocument,
  "\n  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {\n    banUser(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.BanUserFromUserRouteDocument,
  "\n  mutation unbanUserFromUserRoute($id: ID!) {\n    unbanUser(id: $id) {\n      id\n    }\n  }\n":
    types.UnbanUserFromUserRouteDocument,
  "\n  mutation setUserPasswordFromUserRoute(\n    $id: ID!\n    $input: SetUserPasswordInput!\n  ) {\n    setUserPassword(id: $id, input: $input)\n  }\n":
    types.SetUserPasswordFromUserRouteDocument,
  "\n  mutation revokeUserSessionFromUserRoute($userId: ID!, $id: ID!) {\n    revokeSession(userId: $userId, id: $id)\n  }\n":
    types.RevokeUserSessionFromUserRouteDocument,
  "\n  mutation revokeUserSessionsFromUserRoute($userId: ID!) {\n    revokeUserSessions(userId: $userId)\n  }\n":
    types.RevokeUserSessionsFromUserRouteDocument,
  "\n  mutation deleteUserFromUserRoute($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n":
    types.DeleteUserFromUserRouteDocument,
  "\n  mutation impersonateUserFromUserRoute($id: ID!) {\n    impersonateUser(id: $id) {\n      id\n    }\n  }\n":
    types.ImpersonateUserFromUserRouteDocument,
  "\n  mutation createUserFromCreateUserRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n":
    types.CreateUserFromCreateUserRouteDocument,
  "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n":
    types.GetUsersFromUsersRouteDocument,
  "\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n":
    types.SignOutFromSidebarUserDocument,
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n":
    types.GetWorkspacesFromWorkspaceSwitcherDocument,
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n":
    types.GetCurrentUserFromAuthenticatedRouteDocument,
  "\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n":
    types.StopImpersonatingFromAuthenticatedRouteDocument,
  "\n  mutation deleteUserApiKey($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteUserApiKeyDocument,
  "\n  query getUserApiKeyDetails($id: ID!) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKey(id: $id) {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.GetUserApiKeyDetailsDocument,
  "\n  query getUserApiKeyNeighbors(\n    $cursor: String!\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      id\n      previous: apiKeys(\n        last: 1\n        before: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: apiKeys(\n        first: 1\n        after: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n":
    types.GetUserApiKeyNeighborsDocument,
  "\n  mutation createUserApiKey($input: CreateUserApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateUserApiKeyDocument,
  "\n  query getUserApiKeyOptions {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n":
    types.GetUserApiKeyOptionsDocument,
  "\n  query getUserApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            revokedAt\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n":
    types.GetUserApiKeysDocument,
  "\n  query getUserOverview($includeApiKeys: Boolean!) {\n    currentUser {\n      id\n      workspaces(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      sessions(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      apiKeys(first: 1) @include(if: $includeApiKeys) {\n        totalCount\n        totalCountRelation\n      }\n    }\n  }\n":
    types.GetUserOverviewDocument,
  "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    updateCurrentUser(input: $input)\n  }\n":
    types.UpdateUserFromUserRouteDocument,
  "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    changeCurrentUserEmail(input: $input)\n  }\n":
    types.ChangeEmailFromUserRouteDocument,
  "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    changeCurrentUserPassword(input: $input) {\n      token\n    }\n  }\n":
    types.ChangePasswordFromUserSecurityDocument,
  "\n  query getSessionsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      sessions(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            current\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n  }\n":
    types.GetSessionsFromUserSecurityDocument,
  "\n  mutation revokeSessionFromUserSecurity($id: ID!) {\n    revokeCurrentUserSession(id: $id)\n  }\n":
    types.RevokeSessionFromUserSecurityDocument,
  "\n  mutation revokeOtherSessionsFromUserSecurity {\n    revokeCurrentUserOtherSessions\n  }\n":
    types.RevokeOtherSessionsFromUserSecurityDocument,
  "\n  query getAccountsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      accounts(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        totalCount\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            accountId\n            issuer\n            providerId\n            scopes\n            createdAt\n          }\n        }\n      }\n    }\n  }\n":
    types.GetAccountsFromUserSecurityDocument,
  "\n  query getSocialProvidersFromUserSecurity {\n    socialProviders {\n      id\n      name\n    }\n  }\n":
    types.GetSocialProvidersFromUserSecurityDocument,
  "\n  mutation unlinkAccountFromUserSecurity($id: ID!) {\n    unlinkCurrentUserAccount(id: $id)\n  }\n":
    types.UnlinkAccountFromUserSecurityDocument,
  "\n  mutation linkAccountFromUserSecurity($input: AuthLinkSocialAccountInput!) {\n    linkCurrentUserAccount(input: $input) {\n      url\n      redirect\n    }\n  }\n":
    types.LinkAccountFromUserSecurityDocument,
  "\n  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {\n    deleteCurrentUser(input: $input) {\n      success\n      message\n    }\n  }\n":
    types.DeleteUserFromUserSecurityDocument,
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceFromCreateWorkspaceRouteDocument,
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $query: String\n    $filter: WorkspaceFilter\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        query: $query\n        filter: $filter\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n":
    types.GetWorkspacesFromUserWorkspacesRouteDocument,
  "\n  mutation acceptWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.AcceptWorkspaceInvitationFromUserWorkspacesRouteDocument,
  "\n  mutation rejectWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.RejectWorkspaceInvitationFromUserWorkspacesRouteDocument,
  "\n  mutation deleteWorkspaceApiKey($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteWorkspaceApiKeyDocument,
  "\n  query getWorkspaceApiKeyDetails($id: ID!) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    selectedWorkspace {\n      apiKey(id: $id) {\n        member {\n          __typename\n\n          id\n          name\n        }\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.GetWorkspaceApiKeyDetailsDocument,
  "\n  query getWorkspaceApiKeyNeighbors(\n    $cursor: String!\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    selectedWorkspace {\n      id\n    }\n    previous: workspaceApiKeys(\n      last: 1\n      before: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: workspaceApiKeys(\n      first: 1\n      after: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n":
    types.GetWorkspaceApiKeyNeighborsDocument,
  "\n  mutation createWorkspaceApiKey($input: CreateWorkspaceApiKeyInput!) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateWorkspaceApiKeyDocument,
  "\n  query getWorkspaceApiKeyOptions(\n    $includeWorkspaceMembers: Boolean! = false\n    $after: String\n    $memberFilter: WorkspaceMemberFilter\n  ) {\n    selectedWorkspace @include(if: $includeWorkspaceMembers) {\n      members(first: 100, after: $after, filter: $memberFilter) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n":
    types.GetWorkspaceApiKeyOptionsDocument,
  "\n  query getWorkspaceApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          member {\n            __typename\n\n            id\n            name\n            type\n            workspaceId\n          }\n          name\n          start\n          prefix\n          revokedAt\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n":
    types.GetWorkspaceApiKeysDocument,
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentWorkspaceMember {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n":
    types.GetCurrentWorkspaceFromWorkspaceLayoutDocument,
  "\n  mutation setWorkspaceMemberPermissionsFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberPermissionsInput!\n  ) {\n    setWorkspaceMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteDocument,
  "\n  mutation updateWorkspaceMemberFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateWorkspaceMemberFromWorkspaceMemberRouteDocument,
  "\n  mutation setWorkspaceMemberRolesFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberRolesInput!\n  ) {\n    setWorkspaceMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetWorkspaceMemberRolesFromWorkspaceMemberRouteDocument,
  "\n  query getWorkspaceMemberNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n  ) {\n    selectedWorkspace {\n      id\n      previous: members(\n        last: 1\n        before: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: members(\n        first: 1\n        after: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n":
    types.GetWorkspaceMemberNeighborsDocument,
  "\n  query getWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n      createdAt\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n":
    types.GetWorkspaceMemberFromWorkspaceMemberRouteDocument,
  "\n  mutation removeWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n":
    types.RemoveWorkspaceMemberFromWorkspaceMemberRouteDocument,
  "\n  mutation updateWorkspaceMemberStatusFromWorkspaceMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteDocument,
  "\n  query getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n":
    types.GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteDocument,
  "\n  query getRolesFromInviteWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n":
    types.GetRolesFromInviteWorkspaceMemberRouteDocument,
  "\n  mutation createWorkspaceInvitationFromInviteWorkspaceMemberRoute(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteDocument,
  "\n  query getWorkspaceMembersFromWorkspaceMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: WorkspaceInvitationFilter\n    $includeWorkspaceInvitations: Boolean! = false\n  ) {\n    selectedWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            type\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    selectedWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeWorkspaceInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n":
    types.GetWorkspaceMembersFromWorkspaceMembersRouteDocument,
  "\n  mutation cancelWorkspaceInvitationFromWorkspaceMembersRoute($id: ID!) {\n    cancelWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.CancelWorkspaceInvitationFromWorkspaceMembersRouteDocument,
  "\n  query getWorkspaceOverview(\n    $workspaceId: ID!\n    $includeWorkspaceMembers: Boolean!\n    $includeApiKeys: Boolean!\n  ) {\n    workspace(id: $workspaceId) {\n      id\n      members(first: 1) @include(if: $includeWorkspaceMembers) {\n        totalCount\n        totalCountRelation\n      }\n    }\n    workspaceApiKeys(first: 1) @include(if: $includeApiKeys) {\n      totalCount\n      totalCountRelation\n    }\n  }\n":
    types.GetWorkspaceOverviewDocument,
  "\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateWorkspaceFromSettingsRouteDocument,
  "\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n":
    types.DeleteWorkspaceFromSettingsRouteDocument,
  "\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n":
    types.LeaveWorkspaceFromSettingsRouteDocument,
  "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    currentUser {\n      workspaces(first: 1) {\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n":
    types.GetFirstWorkspaceFromWorkspacesRouteDocument,
  "\n  mutation signInFromLoginForm($input: AuthSignInInput!) {\n    signIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n":
    types.SignInFromLoginFormDocument,
  "\n  mutation signUpFromLoginForm($input: AuthSignUpInput!) {\n    signUp(input: $input) {\n      id\n    }\n  }\n":
    types.SignUpFromLoginFormDocument,
  "\n  query getSocialProvidersFromLoginForm {\n    socialProviders {\n      id\n      name\n    }\n  }\n":
    types.GetSocialProvidersFromLoginFormDocument,
  "\n  mutation signInSocialFromLoginForm($input: AuthSignInSocialInput!) {\n    signInSocial(input: $input) {\n      redirect\n      url\n    }\n  }\n":
    types.SignInSocialFromLoginFormDocument,
  "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    requestPasswordReset(input: $input) {\n      status\n    }\n  }\n":
    types.RequestPasswordResetFromForgotPasswordDocument,
  "\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n":
    types.GetCurrentUserFromAuthLayoutDocument,
  "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    resetPassword(input: $input)\n  }\n":
    types.ResetPasswordFromResetPasswordDocument,
  "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    sendVerificationEmail(input: $input)\n  }\n":
    types.SendVerificationEmailFromVerifyEmailDocument,
  "\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n":
    types.GetCurrentUserFromInviteRouteDocument,
  "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n":
    types.GetWorkspaceInvitationFromInviteRouteDocument,
  "\n  mutation acceptWorkspaceInvitationFromInviteRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n":
    types.AcceptWorkspaceInvitationFromInviteRouteDocument,
  "\n  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(\n    $input: AddWorkspaceMemberInput!\n  ) {\n    addWorkspaceMember(input: $input) {\n      id\n    }\n  }\n":
    types.AddWorkspaceServiceAccountFromWorkspaceMembersRouteDocument,
  "\n  mutation revokeUserApiKey($id: ID!) {\n    revokeUserApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n":
    types.RevokeUserApiKeyDocument,
  "\n  mutation revokeWorkspaceApiKey($id: ID!) {\n    revokeWorkspaceApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n":
    types.RevokeWorkspaceApiKeyDocument,
  "\n  mutation updateUserApiKey($id: ID!, $input: UpdateUserApiKeyInput!) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateUserApiKeyDocument,
  "\n  mutation updateWorkspaceApiKey(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateWorkspaceApiKeyDocument,
  "\n  query systemAccountPermissionChoices {\n    systemAccountPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n":
    types.SystemAccountPermissionChoicesDocument,
  "\n  query managedSystemAccount($id: ID!) {\n    systemAccount(id: $id) {\n      id\n      name\n      enabled\n      permissions\n      createdById\n      createdAt\n    }\n  }\n":
    types.ManagedSystemAccountDocument,
  "\n  mutation createManagedSystemAccount($input: CreateSystemAccountInput!) {\n    createSystemAccount(input: $input) {\n      id\n    }\n  }\n":
    types.CreateManagedSystemAccountDocument,
  "\n  mutation updateManagedSystemAccount(\n    $id: ID!\n    $input: UpdateSystemAccountInput!\n  ) {\n    updateSystemAccount(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateManagedSystemAccountDocument,
  "\n  mutation deleteManagedSystemAccount($id: ID!) {\n    deleteSystemAccount(id: $id) {\n      id\n    }\n  }\n":
    types.DeleteManagedSystemAccountDocument,
  "\n  mutation createSystemApiKey($input: CreateSystemApiKeyInput!) {\n    createSystemApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n      }\n    }\n  }\n":
    types.CreateSystemApiKeyDocument,
  "\n  query systemApiKey($id: ID!) {\n    systemApiKey(id: $id) {\n      id\n      name\n      systemAccount {\n        __typename\n\n        id\n        name\n      }\n      revokedAt\n      permissions\n      prefix\n      start\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.SystemApiKeyDocument,
  "\n  mutation updateSystemApiKey($id: ID!, $input: UpdateSystemApiKeyInput!) {\n    updateSystemApiKey(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateSystemApiKeyDocument,
  "\n  mutation deleteSystemApiKey($id: ID!) {\n    deleteSystemApiKey(id: $id) {\n      id\n    }\n  }\n":
    types.DeleteSystemApiKeyDocument,
  "\n  query systemKeyPermissionChoices($systemAccountId: ID, $apiKeyId: ID) {\n    systemApiKeyPermissions(\n      systemAccountId: $systemAccountId\n      apiKeyId: $apiKeyId\n    ) {\n      permission\n      grantable\n      default\n    }\n  }\n":
    types.SystemKeyPermissionChoicesDocument,
  "\n  query systemKeyAccountChoices($after: String) {\n    systemAccounts(first: 100, after: $after, filter: { enabled: true }) {\n      edges {\n        node {\n          id\n          name\n          apiKeyPermissions {\n            permission\n            grantable\n            default\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n":
    types.SystemKeyAccountChoicesDocument,
  "\n  mutation revokeSystemApiKey($id: ID!) {\n    revokeSystemApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n":
    types.RevokeSystemApiKeyDocument,
  "\n  query getPasswordPolicy {\n    passwordPolicy {\n      minLength\n      maxLength\n    }\n  }\n":
    types.GetPasswordPolicyDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query systemApiKeys(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemApiKeyFilter\n    $orderBy: SystemApiKeyOrder\n  ) {\n    systemApiKeys(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          systemAccount {\n            __typename\n\n            id\n            name\n          }\n          revokedAt\n          permissions\n          prefix\n          start\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query systemApiKeys(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemApiKeyFilter\n    $orderBy: SystemApiKeyOrder\n  ) {\n    systemApiKeys(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          systemAccount {\n            __typename\n\n            id\n            name\n          }\n          revokedAt\n          permissions\n          prefix\n          start\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getAdminOverview($includeUsers: Boolean! = true) {\n    users(first: 1) @include(if: $includeUsers) {\n      totalCount\n      totalCountRelation\n    }\n  }\n",
): (typeof documents)["\n  query getAdminOverview($includeUsers: Boolean! = true) {\n    users(first: 1) @include(if: $includeUsers) {\n      totalCount\n      totalCountRelation\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getAdminSystemAccountOverview {\n    systemAccounts(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n",
): (typeof documents)["\n  query getAdminSystemAccountOverview {\n    systemAccounts(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getAdminSystemKeyOverview {\n    systemApiKeys(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n",
): (typeof documents)["\n  query getAdminSystemKeyOverview {\n    systemApiKeys(first: 1) {\n      totalCount\n      totalCountRelation\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query managedSystemAccounts(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemAccountFilter\n    $orderBy: SystemAccountOrder\n  ) {\n    systemAccounts(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          enabled\n          permissions\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n",
): (typeof documents)["\n  query managedSystemAccounts(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $query: String\n    $filter: SystemAccountFilter\n    $orderBy: SystemAccountOrder\n  ) {\n    systemAccounts(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          enabled\n          permissions\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getAdminUserNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: UserFilter\n    $orderBy: UserOrder\n  ) {\n    previous: users(\n      last: 1\n      before: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: users(\n      first: 1\n      after: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getAdminUserNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: UserFilter\n    $orderBy: UserOrder\n  ) {\n    previous: users(\n      last: 1\n      before: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: users(\n      first: 1\n      after: $cursor\n      query: $query\n      filter: $filter\n      orderBy: $orderBy\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserFromUserRoute(\n    $id: ID!\n    $sessionsAfter: String\n    $includeSessions: Boolean! = false\n    $includeRoles: Boolean! = false\n    $includePermissions: Boolean! = false\n  ) {\n    user(id: $id) {\n      id\n      name\n      email\n      emailVerified\n      image\n      roles\n      permissions\n      banned\n      banReason\n      banExpiresAt\n      createdAt\n      updatedAt\n      sessions(\n        first: 20\n        after: $sessionsAfter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeSessions) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n    userRoles @include(if: $includeRoles) {\n      role\n      grantable\n    }\n    userPermissions @include(if: $includePermissions) {\n      permission\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getUserFromUserRoute(\n    $id: ID!\n    $sessionsAfter: String\n    $includeSessions: Boolean! = false\n    $includeRoles: Boolean! = false\n    $includePermissions: Boolean! = false\n  ) {\n    user(id: $id) {\n      id\n      name\n      email\n      emailVerified\n      image\n      roles\n      permissions\n      banned\n      banReason\n      banExpiresAt\n      createdAt\n      updatedAt\n      sessions(\n        first: 20\n        after: $sessionsAfter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeSessions) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n    userRoles @include(if: $includeRoles) {\n      role\n      grantable\n    }\n    userPermissions @include(if: $includePermissions) {\n      permission\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setUserPermissionsFromUserRoute(\n    $id: ID!\n    $input: SetUserPermissionsInput!\n  ) {\n    setUserPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setUserPermissionsFromUserRoute(\n    $id: ID!\n    $input: SetUserPermissionsInput!\n  ) {\n    setUserPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {\n    setUserRoles(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {\n    setUserRoles(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {\n    banUser(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {\n    banUser(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation unbanUserFromUserRoute($id: ID!) {\n    unbanUser(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation unbanUserFromUserRoute($id: ID!) {\n    unbanUser(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setUserPasswordFromUserRoute(\n    $id: ID!\n    $input: SetUserPasswordInput!\n  ) {\n    setUserPassword(id: $id, input: $input)\n  }\n",
): (typeof documents)["\n  mutation setUserPasswordFromUserRoute(\n    $id: ID!\n    $input: SetUserPasswordInput!\n  ) {\n    setUserPassword(id: $id, input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeUserSessionFromUserRoute($userId: ID!, $id: ID!) {\n    revokeSession(userId: $userId, id: $id)\n  }\n",
): (typeof documents)["\n  mutation revokeUserSessionFromUserRoute($userId: ID!, $id: ID!) {\n    revokeSession(userId: $userId, id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeUserSessionsFromUserRoute($userId: ID!) {\n    revokeUserSessions(userId: $userId)\n  }\n",
): (typeof documents)["\n  mutation revokeUserSessionsFromUserRoute($userId: ID!) {\n    revokeUserSessions(userId: $userId)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteUserFromUserRoute($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteUserFromUserRoute($id: ID!) {\n    deleteUser(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation impersonateUserFromUserRoute($id: ID!) {\n    impersonateUser(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation impersonateUserFromUserRoute($id: ID!) {\n    impersonateUser(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createUserFromCreateUserRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createUserFromCreateUserRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n",
): (typeof documents)["\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteUserApiKey($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteUserApiKey($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserApiKeyDetails($id: ID!) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKey(id: $id) {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeyDetails($id: ID!) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKey(id: $id) {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserApiKeyNeighbors(\n    $cursor: String!\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      id\n      previous: apiKeys(\n        last: 1\n        before: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: apiKeys(\n        first: 1\n        after: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeyNeighbors(\n    $cursor: String!\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      id\n      previous: apiKeys(\n        last: 1\n        before: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: apiKeys(\n        first: 1\n        after: $cursor\n        filter: $filter\n        orderBy: $orderBy\n        query: $query\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createUserApiKey($input: CreateUserApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createUserApiKey($input: CreateUserApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserApiKeyOptions {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeyOptions {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            revokedAt\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            revokedAt\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserOverview($includeApiKeys: Boolean!) {\n    currentUser {\n      id\n      workspaces(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      sessions(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      apiKeys(first: 1) @include(if: $includeApiKeys) {\n        totalCount\n        totalCountRelation\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserOverview($includeApiKeys: Boolean!) {\n    currentUser {\n      id\n      workspaces(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      sessions(first: 1) {\n        totalCount\n        totalCountRelation\n      }\n      apiKeys(first: 1) @include(if: $includeApiKeys) {\n        totalCount\n        totalCountRelation\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    updateCurrentUser(input: $input)\n  }\n",
): (typeof documents)["\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    updateCurrentUser(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    changeCurrentUserEmail(input: $input)\n  }\n",
): (typeof documents)["\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    changeCurrentUserEmail(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    changeCurrentUserPassword(input: $input) {\n      token\n    }\n  }\n",
): (typeof documents)["\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    changeCurrentUserPassword(input: $input) {\n      token\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getSessionsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      sessions(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            current\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getSessionsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      sessions(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            current\n            expiresAt\n            ipAddress\n            userAgent\n            createdAt\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeSessionFromUserSecurity($id: ID!) {\n    revokeCurrentUserSession(id: $id)\n  }\n",
): (typeof documents)["\n  mutation revokeSessionFromUserSecurity($id: ID!) {\n    revokeCurrentUserSession(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeOtherSessionsFromUserSecurity {\n    revokeCurrentUserOtherSessions\n  }\n",
): (typeof documents)["\n  mutation revokeOtherSessionsFromUserSecurity {\n    revokeCurrentUserOtherSessions\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getAccountsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      accounts(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        totalCount\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            accountId\n            issuer\n            providerId\n            scopes\n            createdAt\n          }\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getAccountsFromUserSecurity($after: String) {\n    currentUser {\n      id\n      accounts(\n        first: 20\n        after: $after\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        totalCount\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            id\n            accountId\n            issuer\n            providerId\n            scopes\n            createdAt\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getSocialProvidersFromUserSecurity {\n    socialProviders {\n      id\n      name\n    }\n  }\n",
): (typeof documents)["\n  query getSocialProvidersFromUserSecurity {\n    socialProviders {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation unlinkAccountFromUserSecurity($id: ID!) {\n    unlinkCurrentUserAccount(id: $id)\n  }\n",
): (typeof documents)["\n  mutation unlinkAccountFromUserSecurity($id: ID!) {\n    unlinkCurrentUserAccount(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation linkAccountFromUserSecurity($input: AuthLinkSocialAccountInput!) {\n    linkCurrentUserAccount(input: $input) {\n      url\n      redirect\n    }\n  }\n",
): (typeof documents)["\n  mutation linkAccountFromUserSecurity($input: AuthLinkSocialAccountInput!) {\n    linkCurrentUserAccount(input: $input) {\n      url\n      redirect\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {\n    deleteCurrentUser(input: $input) {\n      success\n      message\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {\n    deleteCurrentUser(input: $input) {\n      success\n      message\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $query: String\n    $filter: WorkspaceFilter\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        query: $query\n        filter: $filter\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $query: String\n    $filter: WorkspaceFilter\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        query: $query\n        filter: $filter\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation acceptWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation acceptWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation rejectWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation rejectWorkspaceInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteWorkspaceApiKey($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteWorkspaceApiKey($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceApiKeyDetails($id: ID!) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    selectedWorkspace {\n      apiKey(id: $id) {\n        member {\n          __typename\n\n          id\n          name\n        }\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceApiKeyDetails($id: ID!) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    selectedWorkspace {\n      apiKey(id: $id) {\n        member {\n          __typename\n\n          id\n          name\n        }\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceApiKeyNeighbors(\n    $cursor: String!\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    selectedWorkspace {\n      id\n    }\n    previous: workspaceApiKeys(\n      last: 1\n      before: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: workspaceApiKeys(\n      first: 1\n      after: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceApiKeyNeighbors(\n    $cursor: String!\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    selectedWorkspace {\n      id\n    }\n    previous: workspaceApiKeys(\n      last: 1\n      before: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n    next: workspaceApiKeys(\n      first: 1\n      after: $cursor\n      filter: $filter\n      orderBy: $orderBy\n      query: $query\n    ) {\n      edges {\n        cursor\n        node {\n          id\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceApiKey($input: CreateWorkspaceApiKeyInput!) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceApiKey($input: CreateWorkspaceApiKeyInput!) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        revokedAt\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceApiKeyOptions(\n    $includeWorkspaceMembers: Boolean! = false\n    $after: String\n    $memberFilter: WorkspaceMemberFilter\n  ) {\n    selectedWorkspace @include(if: $includeWorkspaceMembers) {\n      members(first: 100, after: $after, filter: $memberFilter) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceApiKeyOptions(\n    $includeWorkspaceMembers: Boolean! = false\n    $after: String\n    $memberFilter: WorkspaceMemberFilter\n  ) {\n    selectedWorkspace @include(if: $includeWorkspaceMembers) {\n      members(first: 100, after: $after, filter: $memberFilter) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          member {\n            __typename\n\n            id\n            name\n            type\n            workspaceId\n          }\n          name\n          start\n          prefix\n          revokedAt\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceApiKeys(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          member {\n            __typename\n\n            id\n            name\n            type\n            workspaceId\n          }\n          name\n          start\n          prefix\n          revokedAt\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentWorkspaceMember {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentWorkspaceMember {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setWorkspaceMemberPermissionsFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberPermissionsInput!\n  ) {\n    setWorkspaceMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setWorkspaceMemberPermissionsFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberPermissionsInput!\n  ) {\n    setWorkspaceMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceMemberFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceMemberFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setWorkspaceMemberRolesFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberRolesInput!\n  ) {\n    setWorkspaceMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setWorkspaceMemberRolesFromWorkspaceMemberRoute(\n    $id: ID!\n    $input: SetWorkspaceMemberRolesInput!\n  ) {\n    setWorkspaceMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceMemberNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n  ) {\n    selectedWorkspace {\n      id\n      previous: members(\n        last: 1\n        before: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: members(\n        first: 1\n        after: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceMemberNeighbors(\n    $cursor: String!\n    $query: String\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n  ) {\n    selectedWorkspace {\n      id\n      previous: members(\n        last: 1\n        before: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n      next: members(\n        first: 1\n        after: $cursor\n        query: $query\n        filter: $filter\n        orderBy: $orderBy\n      ) {\n        edges {\n          cursor\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n      createdAt\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      type\n      status\n      name\n      email\n      createdAt\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation removeWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation removeWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceMemberStatusFromWorkspaceMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceMemberStatusFromWorkspaceMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getRolesFromInviteWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getRolesFromInviteWorkspaceMemberRoute {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceInvitationFromInviteWorkspaceMemberRoute(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceInvitationFromInviteWorkspaceMemberRoute(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceMembersFromWorkspaceMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: WorkspaceInvitationFilter\n    $includeWorkspaceInvitations: Boolean! = false\n  ) {\n    selectedWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            type\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    selectedWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeWorkspaceInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceMembersFromWorkspaceMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: WorkspaceInvitationFilter\n    $includeWorkspaceInvitations: Boolean! = false\n  ) {\n    selectedWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            type\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    selectedWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeWorkspaceInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation cancelWorkspaceInvitationFromWorkspaceMembersRoute($id: ID!) {\n    cancelWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation cancelWorkspaceInvitationFromWorkspaceMembersRoute($id: ID!) {\n    cancelWorkspaceInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceOverview(\n    $workspaceId: ID!\n    $includeWorkspaceMembers: Boolean!\n    $includeApiKeys: Boolean!\n  ) {\n    workspace(id: $workspaceId) {\n      id\n      members(first: 1) @include(if: $includeWorkspaceMembers) {\n        totalCount\n        totalCountRelation\n      }\n    }\n    workspaceApiKeys(first: 1) @include(if: $includeApiKeys) {\n      totalCount\n      totalCountRelation\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceOverview(\n    $workspaceId: ID!\n    $includeWorkspaceMembers: Boolean!\n    $includeApiKeys: Boolean!\n  ) {\n    workspace(id: $workspaceId) {\n      id\n      members(first: 1) @include(if: $includeWorkspaceMembers) {\n        totalCount\n        totalCountRelation\n      }\n    }\n    workspaceApiKeys(first: 1) @include(if: $includeApiKeys) {\n      totalCount\n      totalCountRelation\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n",
): (typeof documents)["\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    currentUser {\n      workspaces(first: 1) {\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getFirstWorkspaceFromWorkspacesRoute {\n    currentUser {\n      workspaces(first: 1) {\n        edges {\n          node {\n            id\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation signInFromLoginForm($input: AuthSignInInput!) {\n    signIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation signInFromLoginForm($input: AuthSignInInput!) {\n    signIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation signUpFromLoginForm($input: AuthSignUpInput!) {\n    signUp(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation signUpFromLoginForm($input: AuthSignUpInput!) {\n    signUp(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getSocialProvidersFromLoginForm {\n    socialProviders {\n      id\n      name\n    }\n  }\n",
): (typeof documents)["\n  query getSocialProvidersFromLoginForm {\n    socialProviders {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation signInSocialFromLoginForm($input: AuthSignInSocialInput!) {\n    signInSocial(input: $input) {\n      redirect\n      url\n    }\n  }\n",
): (typeof documents)["\n  mutation signInSocialFromLoginForm($input: AuthSignInSocialInput!) {\n    signInSocial(input: $input) {\n      redirect\n      url\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    requestPasswordReset(input: $input) {\n      status\n    }\n  }\n",
): (typeof documents)["\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    requestPasswordReset(input: $input) {\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    resetPassword(input: $input)\n  }\n",
): (typeof documents)["\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    resetPassword(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    sendVerificationEmail(input: $input)\n  }\n",
): (typeof documents)["\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    sendVerificationEmail(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation acceptWorkspaceInvitationFromInviteRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n",
): (typeof documents)["\n  mutation acceptWorkspaceInvitationFromInviteRoute($id: ID!) {\n    acceptWorkspaceInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(\n    $input: AddWorkspaceMemberInput!\n  ) {\n    addWorkspaceMember(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(\n    $input: AddWorkspaceMemberInput!\n  ) {\n    addWorkspaceMember(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeUserApiKey($id: ID!) {\n    revokeUserApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n",
): (typeof documents)["\n  mutation revokeUserApiKey($id: ID!) {\n    revokeUserApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeWorkspaceApiKey($id: ID!) {\n    revokeWorkspaceApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n",
): (typeof documents)["\n  mutation revokeWorkspaceApiKey($id: ID!) {\n    revokeWorkspaceApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateUserApiKey($id: ID!, $input: UpdateUserApiKeyInput!) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateUserApiKey($id: ID!, $input: UpdateUserApiKeyInput!) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceApiKey(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceApiKey(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      revokedAt\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query systemAccountPermissionChoices {\n    systemAccountPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n",
): (typeof documents)["\n  query systemAccountPermissionChoices {\n    systemAccountPermissions {\n      permission\n      grantable\n      default\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query managedSystemAccount($id: ID!) {\n    systemAccount(id: $id) {\n      id\n      name\n      enabled\n      permissions\n      createdById\n      createdAt\n    }\n  }\n",
): (typeof documents)["\n  query managedSystemAccount($id: ID!) {\n    systemAccount(id: $id) {\n      id\n      name\n      enabled\n      permissions\n      createdById\n      createdAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createManagedSystemAccount($input: CreateSystemAccountInput!) {\n    createSystemAccount(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createManagedSystemAccount($input: CreateSystemAccountInput!) {\n    createSystemAccount(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateManagedSystemAccount(\n    $id: ID!\n    $input: UpdateSystemAccountInput!\n  ) {\n    updateSystemAccount(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateManagedSystemAccount(\n    $id: ID!\n    $input: UpdateSystemAccountInput!\n  ) {\n    updateSystemAccount(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteManagedSystemAccount($id: ID!) {\n    deleteSystemAccount(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteManagedSystemAccount($id: ID!) {\n    deleteSystemAccount(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createSystemApiKey($input: CreateSystemApiKeyInput!) {\n    createSystemApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createSystemApiKey($input: CreateSystemApiKeyInput!) {\n    createSystemApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query systemApiKey($id: ID!) {\n    systemApiKey(id: $id) {\n      id\n      name\n      systemAccount {\n        __typename\n\n        id\n        name\n      }\n      revokedAt\n      permissions\n      prefix\n      start\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  query systemApiKey($id: ID!) {\n    systemApiKey(id: $id) {\n      id\n      name\n      systemAccount {\n        __typename\n\n        id\n        name\n      }\n      revokedAt\n      permissions\n      prefix\n      start\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateSystemApiKey($id: ID!, $input: UpdateSystemApiKeyInput!) {\n    updateSystemApiKey(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateSystemApiKey($id: ID!, $input: UpdateSystemApiKeyInput!) {\n    updateSystemApiKey(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteSystemApiKey($id: ID!) {\n    deleteSystemApiKey(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteSystemApiKey($id: ID!) {\n    deleteSystemApiKey(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query systemKeyPermissionChoices($systemAccountId: ID, $apiKeyId: ID) {\n    systemApiKeyPermissions(\n      systemAccountId: $systemAccountId\n      apiKeyId: $apiKeyId\n    ) {\n      permission\n      grantable\n      default\n    }\n  }\n",
): (typeof documents)["\n  query systemKeyPermissionChoices($systemAccountId: ID, $apiKeyId: ID) {\n    systemApiKeyPermissions(\n      systemAccountId: $systemAccountId\n      apiKeyId: $apiKeyId\n    ) {\n      permission\n      grantable\n      default\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query systemKeyAccountChoices($after: String) {\n    systemAccounts(first: 100, after: $after, filter: { enabled: true }) {\n      edges {\n        node {\n          id\n          name\n          apiKeyPermissions {\n            permission\n            grantable\n            default\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query systemKeyAccountChoices($after: String) {\n    systemAccounts(first: 100, after: $after, filter: { enabled: true }) {\n      edges {\n        node {\n          id\n          name\n          apiKeyPermissions {\n            permission\n            grantable\n            default\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeSystemApiKey($id: ID!) {\n    revokeSystemApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n",
): (typeof documents)["\n  mutation revokeSystemApiKey($id: ID!) {\n    revokeSystemApiKey(id: $id) {\n      id\n      revokedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getPasswordPolicy {\n    passwordPolicy {\n      minLength\n      maxLength\n    }\n  }\n",
): (typeof documents)["\n  query getPasswordPolicy {\n    passwordPolicy {\n      minLength\n      maxLength\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
