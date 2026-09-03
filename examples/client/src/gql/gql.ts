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
  "\n  mutation authSignOutFromSidebarUser {\n    authSignOut\n  }\n": typeof types.AuthSignOutFromSidebarUserDocument;
  "\n  query getCurrentUserFromCurrentUserContext {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n": typeof types.GetCurrentUserFromCurrentUserContextDocument;
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n    }\n  }\n": typeof types.GetCurrentUserFromAuthenticatedRouteDocument;
  "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    userApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n": typeof types.GetUserApiKeysFromUserApiKeysRouteDocument;
  "\n  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateUserApiKeyFromUserApiKeysRouteDocument;
  "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateUserApiKeyFromUserApiKeysRouteDocument;
  "\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteUserApiKeyFromUserApiKeysRouteDocument;
  "\n  query getCurrentUserFromUserRoute {\n    currentUser {\n      id\n      name\n      email\n      createdAt\n    }\n  }\n": typeof types.GetCurrentUserFromUserRouteDocument;
  "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    authUpdateUser(input: $input)\n  }\n": typeof types.UpdateUserFromUserRouteDocument;
  "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    authChangeEmail(input: $input)\n  }\n": typeof types.ChangeEmailFromUserRouteDocument;
  "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    authChangePassword(input: $input) {\n      token\n    }\n  }\n": typeof types.ChangePasswordFromUserSecurityDocument;
  "\n  query getSessionsFromUserSecurity {\n    authSessions {\n      id\n      token\n      current\n      expiresAt\n      ipAddress\n      userAgent\n      createdAt\n    }\n  }\n": typeof types.GetSessionsFromUserSecurityDocument;
  "\n  mutation revokeSessionFromUserSecurity($token: String!) {\n    authRevokeSession(token: $token)\n  }\n": typeof types.RevokeSessionFromUserSecurityDocument;
  "\n  mutation revokeOtherSessionsFromUserSecurity {\n    authRevokeOtherSessions\n  }\n": typeof types.RevokeOtherSessionsFromUserSecurityDocument;
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n": typeof types.GetWorkspacesFromUserWorkspacesRouteDocument;
  "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    apiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n": typeof types.GetApiKeysFromApiKeysRouteDocument;
  "\n  mutation createApiKeyFromApiKeysRoute($input: CreateApiKeyInput!) {\n    createApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateApiKeyFromApiKeysRouteDocument;
  "\n  mutation updateApiKeyFromApiKeysRoute($id: ID!, $input: UpdateApiKeyInput!) {\n    updateApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateApiKeyFromApiKeysRouteDocument;
  "\n  mutation deleteApiKeyFromApiKeysRoute($id: ID!) {\n    deleteApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteApiKeyFromApiKeysRouteDocument;
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      first: $first\n      after: $after\n      before: $before\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n": typeof types.GetWorkspacesFromWorkspaceSwitcherDocument;
  "\n  query getCurrentWorkspaceFromWorkspaceContext {\n    currentWorkspace {\n      id\n      name\n      features\n      createdAt\n      updatedAt\n    }\n  }\n": typeof types.GetCurrentWorkspaceFromWorkspaceContextDocument;
  "\n  query getCurrentWorkspaceMemberFromWorkspaceMemberContext {\n    currentWorkspaceMember {\n      id\n      role\n      name\n      email\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n": typeof types.GetCurrentWorkspaceMemberFromWorkspaceMemberContextDocument;
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n    }\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n": typeof types.GetCurrentWorkspaceFromWorkspaceLayoutDocument;
  "\n  query getCurrentWorkspaceMemberFromMemberRoute {\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n": typeof types.GetCurrentWorkspaceMemberFromMemberRouteDocument;
  "\n  query getWorkspaceMemberFromMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n": typeof types.GetWorkspaceMemberFromMemberRouteDocument;
  "\n  mutation updateWorkspaceMemberFromMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n": typeof types.UpdateWorkspaceMemberFromMemberRouteDocument;
  "\n  mutation removeWorkspaceMemberFromMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n": typeof types.RemoveWorkspaceMemberFromMemberRouteDocument;
  "\n  mutation createWorkspaceInvitationFromInviteMemberDialog(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceInvitationFromInviteMemberDialogDocument;
  "\n  query getWorkspaceMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n  ) {\n    workspaceMembers(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          role\n          status\n          createdAt\n          user {\n            id\n            name\n            email\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n    workspaceInvitations {\n      id\n      email\n      role\n      status\n      expiresAt\n    }\n  }\n": typeof types.GetWorkspaceMembersFromMembersRouteDocument;
  "\n  mutation cancelWorkspaceInvitationFromMembersRoute($invitationId: ID!) {\n    cancelWorkspaceInvitation(invitationId: $invitationId) {\n      id\n      status\n    }\n  }\n": typeof types.CancelWorkspaceInvitationFromMembersRouteDocument;
  "\n  mutation removeWorkspaceMemberFromMembersRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n": typeof types.RemoveWorkspaceMemberFromMembersRouteDocument;
  "\n  mutation updateWorkspaceMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      status\n    }\n  }\n": typeof types.UpdateWorkspaceMemberStatusFromMembersRouteDocument;
  "\n  mutation updateWorkspaceFromSettingsRoute($input: UpdateWorkspaceInput!) {\n    updateWorkspace(input: $input) {\n      id\n      name\n    }\n  }\n": typeof types.UpdateWorkspaceFromSettingsRouteDocument;
  "\n  mutation deleteWorkspaceFromSettingsRoute {\n    deleteWorkspace {\n      id\n    }\n  }\n": typeof types.DeleteWorkspaceFromSettingsRouteDocument;
  "\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceFromCreateWorkspaceFormDocument;
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceFromCreateWorkspaceRouteDocument;
  "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    workspaces(first: 1) {\n      edges {\n        node {\n          id\n        }\n      }\n    }\n  }\n": typeof types.GetFirstWorkspaceFromWorkspacesRouteDocument;
  "\n  mutation authSignInFromLoginForm($input: AuthSignInInput!) {\n    authSignIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n": typeof types.AuthSignInFromLoginFormDocument;
  "\n  mutation authSignUpFromLoginForm($input: AuthSignUpInput!) {\n    authSignUp(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n": typeof types.AuthSignUpFromLoginFormDocument;
  "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    authRequestPasswordReset(input: $input) {\n      status\n    }\n  }\n": typeof types.RequestPasswordResetFromForgotPasswordDocument;
  "\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n": typeof types.GetCurrentUserFromAuthLayoutDocument;
  "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    authResetPassword(input: $input)\n  }\n": typeof types.ResetPasswordFromResetPasswordDocument;
  "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    authSendVerificationEmail(input: $input)\n  }\n": typeof types.SendVerificationEmailFromVerifyEmailDocument;
  "\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n": typeof types.GetCurrentUserFromInviteRouteDocument;
  "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      id\n      email\n      role\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n": typeof types.GetWorkspaceInvitationFromInviteRouteDocument;
  "\n  mutation acceptWorkspaceInvitationFromInviteRoute($invitationId: ID!) {\n    acceptWorkspaceInvitation(invitationId: $invitationId) {\n      invitation {\n        id\n        status\n        workspace {\n          id\n        }\n      }\n      member {\n        id\n        name\n        role\n      }\n    }\n  }\n": typeof types.AcceptWorkspaceInvitationFromInviteRouteDocument;
};
const documents: Documents = {
  "\n  mutation authSignOutFromSidebarUser {\n    authSignOut\n  }\n":
    types.AuthSignOutFromSidebarUserDocument,
  "\n  query getCurrentUserFromCurrentUserContext {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n":
    types.GetCurrentUserFromCurrentUserContextDocument,
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n    }\n  }\n":
    types.GetCurrentUserFromAuthenticatedRouteDocument,
  "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    userApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n":
    types.GetUserApiKeysFromUserApiKeysRouteDocument,
  "\n  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateUserApiKeyFromUserApiKeysRouteDocument,
  "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateUserApiKeyFromUserApiKeysRouteDocument,
  "\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteUserApiKeyFromUserApiKeysRouteDocument,
  "\n  query getCurrentUserFromUserRoute {\n    currentUser {\n      id\n      name\n      email\n      createdAt\n    }\n  }\n":
    types.GetCurrentUserFromUserRouteDocument,
  "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    authUpdateUser(input: $input)\n  }\n":
    types.UpdateUserFromUserRouteDocument,
  "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    authChangeEmail(input: $input)\n  }\n":
    types.ChangeEmailFromUserRouteDocument,
  "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    authChangePassword(input: $input) {\n      token\n    }\n  }\n":
    types.ChangePasswordFromUserSecurityDocument,
  "\n  query getSessionsFromUserSecurity {\n    authSessions {\n      id\n      token\n      current\n      expiresAt\n      ipAddress\n      userAgent\n      createdAt\n    }\n  }\n":
    types.GetSessionsFromUserSecurityDocument,
  "\n  mutation revokeSessionFromUserSecurity($token: String!) {\n    authRevokeSession(token: $token)\n  }\n":
    types.RevokeSessionFromUserSecurityDocument,
  "\n  mutation revokeOtherSessionsFromUserSecurity {\n    authRevokeOtherSessions\n  }\n":
    types.RevokeOtherSessionsFromUserSecurityDocument,
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n":
    types.GetWorkspacesFromUserWorkspacesRouteDocument,
  "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    apiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n":
    types.GetApiKeysFromApiKeysRouteDocument,
  "\n  mutation createApiKeyFromApiKeysRoute($input: CreateApiKeyInput!) {\n    createApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateApiKeyFromApiKeysRouteDocument,
  "\n  mutation updateApiKeyFromApiKeysRoute($id: ID!, $input: UpdateApiKeyInput!) {\n    updateApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateApiKeyFromApiKeysRouteDocument,
  "\n  mutation deleteApiKeyFromApiKeysRoute($id: ID!) {\n    deleteApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteApiKeyFromApiKeysRouteDocument,
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      first: $first\n      after: $after\n      before: $before\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n":
    types.GetWorkspacesFromWorkspaceSwitcherDocument,
  "\n  query getCurrentWorkspaceFromWorkspaceContext {\n    currentWorkspace {\n      id\n      name\n      features\n      createdAt\n      updatedAt\n    }\n  }\n":
    types.GetCurrentWorkspaceFromWorkspaceContextDocument,
  "\n  query getCurrentWorkspaceMemberFromWorkspaceMemberContext {\n    currentWorkspaceMember {\n      id\n      role\n      name\n      email\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n":
    types.GetCurrentWorkspaceMemberFromWorkspaceMemberContextDocument,
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n    }\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n":
    types.GetCurrentWorkspaceFromWorkspaceLayoutDocument,
  "\n  query getCurrentWorkspaceMemberFromMemberRoute {\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n":
    types.GetCurrentWorkspaceMemberFromMemberRouteDocument,
  "\n  query getWorkspaceMemberFromMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n":
    types.GetWorkspaceMemberFromMemberRouteDocument,
  "\n  mutation updateWorkspaceMemberFromMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n":
    types.UpdateWorkspaceMemberFromMemberRouteDocument,
  "\n  mutation removeWorkspaceMemberFromMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n":
    types.RemoveWorkspaceMemberFromMemberRouteDocument,
  "\n  mutation createWorkspaceInvitationFromInviteMemberDialog(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceInvitationFromInviteMemberDialogDocument,
  "\n  query getWorkspaceMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n  ) {\n    workspaceMembers(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          role\n          status\n          createdAt\n          user {\n            id\n            name\n            email\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n    workspaceInvitations {\n      id\n      email\n      role\n      status\n      expiresAt\n    }\n  }\n":
    types.GetWorkspaceMembersFromMembersRouteDocument,
  "\n  mutation cancelWorkspaceInvitationFromMembersRoute($invitationId: ID!) {\n    cancelWorkspaceInvitation(invitationId: $invitationId) {\n      id\n      status\n    }\n  }\n":
    types.CancelWorkspaceInvitationFromMembersRouteDocument,
  "\n  mutation removeWorkspaceMemberFromMembersRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n":
    types.RemoveWorkspaceMemberFromMembersRouteDocument,
  "\n  mutation updateWorkspaceMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      status\n    }\n  }\n":
    types.UpdateWorkspaceMemberStatusFromMembersRouteDocument,
  "\n  mutation updateWorkspaceFromSettingsRoute($input: UpdateWorkspaceInput!) {\n    updateWorkspace(input: $input) {\n      id\n      name\n    }\n  }\n":
    types.UpdateWorkspaceFromSettingsRouteDocument,
  "\n  mutation deleteWorkspaceFromSettingsRoute {\n    deleteWorkspace {\n      id\n    }\n  }\n":
    types.DeleteWorkspaceFromSettingsRouteDocument,
  "\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceFromCreateWorkspaceFormDocument,
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceFromCreateWorkspaceRouteDocument,
  "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    workspaces(first: 1) {\n      edges {\n        node {\n          id\n        }\n      }\n    }\n  }\n":
    types.GetFirstWorkspaceFromWorkspacesRouteDocument,
  "\n  mutation authSignInFromLoginForm($input: AuthSignInInput!) {\n    authSignIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n":
    types.AuthSignInFromLoginFormDocument,
  "\n  mutation authSignUpFromLoginForm($input: AuthSignUpInput!) {\n    authSignUp(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n":
    types.AuthSignUpFromLoginFormDocument,
  "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    authRequestPasswordReset(input: $input) {\n      status\n    }\n  }\n":
    types.RequestPasswordResetFromForgotPasswordDocument,
  "\n  query getCurrentUserFromAuthLayout {\n    currentUser {\n      id\n    }\n  }\n":
    types.GetCurrentUserFromAuthLayoutDocument,
  "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    authResetPassword(input: $input)\n  }\n":
    types.ResetPasswordFromResetPasswordDocument,
  "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    authSendVerificationEmail(input: $input)\n  }\n":
    types.SendVerificationEmailFromVerifyEmailDocument,
  "\n  query getCurrentUserFromInviteRoute {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n":
    types.GetCurrentUserFromInviteRouteDocument,
  "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      id\n      email\n      role\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n":
    types.GetWorkspaceInvitationFromInviteRouteDocument,
  "\n  mutation acceptWorkspaceInvitationFromInviteRoute($invitationId: ID!) {\n    acceptWorkspaceInvitation(invitationId: $invitationId) {\n      invitation {\n        id\n        status\n        workspace {\n          id\n        }\n      }\n      member {\n        id\n        name\n        role\n      }\n    }\n  }\n":
    types.AcceptWorkspaceInvitationFromInviteRouteDocument,
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
  source: "\n  mutation authSignOutFromSidebarUser {\n    authSignOut\n  }\n",
): (typeof documents)["\n  mutation authSignOutFromSidebarUser {\n    authSignOut\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromCurrentUserContext {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromCurrentUserContext {\n    currentUser {\n      id\n      name\n      email\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    userApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    userApiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentUserFromUserRoute {\n    currentUser {\n      id\n      name\n      email\n      createdAt\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentUserFromUserRoute {\n    currentUser {\n      id\n      name\n      email\n      createdAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    authUpdateUser(input: $input)\n  }\n",
): (typeof documents)["\n  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {\n    authUpdateUser(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    authChangeEmail(input: $input)\n  }\n",
): (typeof documents)["\n  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {\n    authChangeEmail(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    authChangePassword(input: $input) {\n      token\n    }\n  }\n",
): (typeof documents)["\n  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {\n    authChangePassword(input: $input) {\n      token\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getSessionsFromUserSecurity {\n    authSessions {\n      id\n      token\n      current\n      expiresAt\n      ipAddress\n      userAgent\n      createdAt\n    }\n  }\n",
): (typeof documents)["\n  query getSessionsFromUserSecurity {\n    authSessions {\n      id\n      token\n      current\n      expiresAt\n      ipAddress\n      userAgent\n      createdAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeSessionFromUserSecurity($token: String!) {\n    authRevokeSession(token: $token)\n  }\n",
): (typeof documents)["\n  mutation revokeSessionFromUserSecurity($token: String!) {\n    authRevokeSession(token: $token)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation revokeOtherSessionsFromUserSecurity {\n    authRevokeOtherSessions\n  }\n",
): (typeof documents)["\n  mutation revokeOtherSessionsFromUserSecurity {\n    authRevokeOtherSessions\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    apiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: ApiKeyFilter\n    $orderBy: ApiKeyOrder\n    $query: String\n  ) {\n    apiKeys(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          start\n          prefix\n          enabled\n          permissions\n          createdAt\n          lastUsedAt\n          expiresAt\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createApiKeyFromApiKeysRoute($input: CreateApiKeyInput!) {\n    createApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createApiKeyFromApiKeysRoute($input: CreateApiKeyInput!) {\n    createApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateApiKeyFromApiKeysRoute($id: ID!, $input: UpdateApiKeyInput!) {\n    updateApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateApiKeyFromApiKeysRoute($id: ID!, $input: UpdateApiKeyInput!) {\n    updateApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteApiKeyFromApiKeysRoute($id: ID!) {\n    deleteApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteApiKeyFromApiKeysRoute($id: ID!) {\n    deleteApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      first: $first\n      after: $after\n      before: $before\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    workspaces(\n      first: $first\n      after: $after\n      before: $before\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceFromWorkspaceContext {\n    currentWorkspace {\n      id\n      name\n      features\n      createdAt\n      updatedAt\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceFromWorkspaceContext {\n    currentWorkspace {\n      id\n      name\n      features\n      createdAt\n      updatedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceMemberFromWorkspaceMemberContext {\n    currentWorkspaceMember {\n      id\n      role\n      name\n      email\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceMemberFromWorkspaceMemberContext {\n    currentWorkspaceMember {\n      id\n      role\n      name\n      email\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n    }\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n    }\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceMemberFromMemberRoute {\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceMemberFromMemberRoute {\n    currentWorkspaceMember {\n      id\n      role\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceMemberFromMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceMemberFromMemberRoute($id: ID!) {\n    workspaceMember(id: $id) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceMemberFromMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceMemberFromMemberRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      name\n      email\n      role\n      permissions\n      status\n      user {\n        email\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation removeWorkspaceMemberFromMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation removeWorkspaceMemberFromMemberRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceInvitationFromInviteMemberDialog(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceInvitationFromInviteMemberDialog(\n    $input: CreateWorkspaceInvitationInput!\n  ) {\n    createWorkspaceInvitation(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getWorkspaceMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n  ) {\n    workspaceMembers(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          role\n          status\n          createdAt\n          user {\n            id\n            name\n            email\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n    workspaceInvitations {\n      id\n      email\n      role\n      status\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceMemberFilter\n    $orderBy: WorkspaceMemberOrder\n    $query: String\n  ) {\n    workspaceMembers(\n      after: $after\n      before: $before\n      first: $first\n      last: $last\n      orderBy: $orderBy\n      filter: $filter\n      query: $query\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          role\n          status\n          createdAt\n          user {\n            id\n            name\n            email\n          }\n        }\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        startCursor\n      }\n    }\n    workspaceInvitations {\n      id\n      email\n      role\n      status\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation cancelWorkspaceInvitationFromMembersRoute($invitationId: ID!) {\n    cancelWorkspaceInvitation(invitationId: $invitationId) {\n      id\n      status\n    }\n  }\n",
): (typeof documents)["\n  mutation cancelWorkspaceInvitationFromMembersRoute($invitationId: ID!) {\n    cancelWorkspaceInvitation(invitationId: $invitationId) {\n      id\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation removeWorkspaceMemberFromMembersRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation removeWorkspaceMemberFromMembersRoute($id: ID!) {\n    removeWorkspaceMember(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      status\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateWorkspaceMemberInput!\n  ) {\n    updateWorkspaceMember(id: $id, input: $input) {\n      id\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceFromSettingsRoute($input: UpdateWorkspaceInput!) {\n    updateWorkspace(input: $input) {\n      id\n      name\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceFromSettingsRoute($input: UpdateWorkspaceInput!) {\n    updateWorkspace(input: $input) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteWorkspaceFromSettingsRoute {\n    deleteWorkspace {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteWorkspaceFromSettingsRoute {\n    deleteWorkspace {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n"];
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
  source: "\n  query getFirstWorkspaceFromWorkspacesRoute {\n    workspaces(first: 1) {\n      edges {\n        node {\n          id\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getFirstWorkspaceFromWorkspacesRoute {\n    workspaces(first: 1) {\n      edges {\n        node {\n          id\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation authSignInFromLoginForm($input: AuthSignInInput!) {\n    authSignIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation authSignInFromLoginForm($input: AuthSignInInput!) {\n    authSignIn(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation authSignUpFromLoginForm($input: AuthSignUpInput!) {\n    authSignUp(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation authSignUpFromLoginForm($input: AuthSignUpInput!) {\n    authSignUp(input: $input) {\n      user {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    authRequestPasswordReset(input: $input) {\n      status\n    }\n  }\n",
): (typeof documents)["\n  mutation requestPasswordResetFromForgotPassword(\n    $input: AuthRequestPasswordResetInput!\n  ) {\n    authRequestPasswordReset(input: $input) {\n      status\n    }\n  }\n"];
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
  source: "\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    authResetPassword(input: $input)\n  }\n",
): (typeof documents)["\n  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {\n    authResetPassword(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    authSendVerificationEmail(input: $input)\n  }\n",
): (typeof documents)["\n  mutation sendVerificationEmailFromVerifyEmail(\n    $input: AuthSendVerificationEmailInput!\n  ) {\n    authSendVerificationEmail(input: $input)\n  }\n"];
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
  source: "\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      id\n      email\n      role\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspaceInvitationFromInviteRoute($id: ID!) {\n    workspaceInvitation(id: $id) {\n      id\n      email\n      role\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation acceptWorkspaceInvitationFromInviteRoute($invitationId: ID!) {\n    acceptWorkspaceInvitation(invitationId: $invitationId) {\n      invitation {\n        id\n        status\n        workspace {\n          id\n        }\n      }\n      member {\n        id\n        name\n        role\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation acceptWorkspaceInvitationFromInviteRoute($invitationId: ID!) {\n    acceptWorkspaceInvitation(invitationId: $invitationId) {\n      invitation {\n        id\n        status\n        workspace {\n          id\n        }\n      }\n      member {\n        id\n        name\n        role\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
