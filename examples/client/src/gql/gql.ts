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
  "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": typeof types.GetUsersFromUsersRouteDocument;
  "\n  mutation createUserFromUsersRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateUserFromUsersRouteDocument;
  "\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n": typeof types.SignOutFromSidebarUserDocument;
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n": typeof types.GetWorkspacesFromWorkspaceSwitcherDocument;
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n": typeof types.GetCurrentUserFromAuthenticatedRouteDocument;
  "\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n": typeof types.StopImpersonatingFromAuthenticatedRouteDocument;
  "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n": typeof types.GetUserApiKeysFromUserApiKeysRouteDocument;
  "\n  mutation createUserApiKeyFromUserApiKeysRoute(\n    $input: CreateUserApiKeyInput!\n  ) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateUserApiKeyFromUserApiKeysRouteDocument;
  "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateUserApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateUserApiKeyFromUserApiKeysRouteDocument;
  "\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteUserApiKeyFromUserApiKeysRouteDocument;
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
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n": typeof types.GetWorkspacesFromUserWorkspacesRouteDocument;
  "\n  mutation acceptInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.AcceptInvitationFromUserWorkspacesRouteDocument;
  "\n  mutation rejectInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.RejectInvitationFromUserWorkspacesRouteDocument;
  "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentWorkspace {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n": typeof types.GetApiKeysFromApiKeysRouteDocument;
  "\n  mutation createWorkspaceApiKeyFromApiKeysRoute(\n    $input: CreateWorkspaceApiKeyInput!\n  ) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        workspaceId\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n": typeof types.CreateWorkspaceApiKeyFromApiKeysRouteDocument;
  "\n  mutation updateWorkspaceApiKeyFromApiKeysRoute(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.UpdateWorkspaceApiKeyFromApiKeysRouteDocument;
  "\n  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n": typeof types.DeleteWorkspaceApiKeyFromApiKeysRouteDocument;
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentMember {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n": typeof types.GetCurrentWorkspaceFromWorkspaceLayoutDocument;
  "\n  mutation setMemberPermissionsFromMemberRoute(\n    $id: ID!\n    $input: SetMemberPermissionsInput!\n  ) {\n    setMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetMemberPermissionsFromMemberRouteDocument;
  "\n  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateMemberFromMemberRouteDocument;
  "\n  mutation setMemberRolesFromMemberRoute(\n    $id: ID!\n    $input: SetMemberRolesInput!\n  ) {\n    setMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.SetMemberRolesFromMemberRouteDocument;
  "\n  query getMemberFromMemberRoute($id: ID!) {\n    member(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n": typeof types.GetMemberFromMemberRouteDocument;
  "\n  mutation removeMemberFromMemberRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n": typeof types.RemoveMemberFromMemberRouteDocument;
  "\n  query getRolesFromInviteMemberDialog {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n": typeof types.GetRolesFromInviteMemberDialogDocument;
  "\n  mutation createInvitationFromInviteMemberDialog(\n    $input: CreateInvitationInput!\n  ) {\n    createInvitation(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateInvitationFromInviteMemberDialogDocument;
  "\n  query getMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: MemberFilter\n    $orderBy: MemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: InvitationFilter\n    $includeInvitations: Boolean! = false\n  ) {\n    currentWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n": typeof types.GetMembersFromMembersRouteDocument;
  "\n  mutation cancelInvitationFromMembersRoute($id: ID!) {\n    cancelInvitation(id: $id) {\n      id\n    }\n  }\n": typeof types.CancelInvitationFromMembersRouteDocument;
  "\n  mutation removeMemberFromMembersRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n": typeof types.RemoveMemberFromMembersRouteDocument;
  "\n  mutation updateMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateMemberInput!\n  ) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateMemberStatusFromMembersRouteDocument;
  "\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateWorkspaceFromSettingsRouteDocument;
  "\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkspaceFromSettingsRouteDocument;
  "\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n": typeof types.LeaveWorkspaceFromSettingsRouteDocument;
  "\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceFromCreateWorkspaceFormDocument;
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n": typeof types.CreateWorkspaceFromCreateWorkspaceRouteDocument;
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
  "\n  query getInvitationFromInviteRoute($id: ID!) {\n    invitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n": typeof types.GetInvitationFromInviteRouteDocument;
  "\n  mutation acceptInvitationFromInviteRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n": typeof types.AcceptInvitationFromInviteRouteDocument;
};
const documents: Documents = {
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
  "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n":
    types.GetUsersFromUsersRouteDocument,
  "\n  mutation createUserFromUsersRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n":
    types.CreateUserFromUsersRouteDocument,
  "\n  mutation signOutFromSidebarUser {\n    signOut\n  }\n":
    types.SignOutFromSidebarUserDocument,
  "\n  query getWorkspacesFromWorkspaceSwitcher(\n    $first: Int\n    $after: String\n    $before: String\n    $query: String\n    $orderBy: WorkspaceOrder\n  ) {\n    currentUser {\n      workspaces(\n        first: $first\n        after: $after\n        before: $before\n        query: $query\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          startCursor\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n":
    types.GetWorkspacesFromWorkspaceSwitcherDocument,
  "\n  query getCurrentUserFromAuthenticatedRoute {\n    currentUser {\n      id\n      name\n      email\n      permissions\n    }\n    currentSession {\n      impersonatedById\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n":
    types.GetCurrentUserFromAuthenticatedRouteDocument,
  "\n  mutation stopImpersonatingFromAuthenticatedRoute {\n    stopImpersonating {\n      id\n    }\n  }\n":
    types.StopImpersonatingFromAuthenticatedRouteDocument,
  "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n":
    types.GetUserApiKeysFromUserApiKeysRouteDocument,
  "\n  mutation createUserApiKeyFromUserApiKeysRoute(\n    $input: CreateUserApiKeyInput!\n  ) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateUserApiKeyFromUserApiKeysRouteDocument,
  "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateUserApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateUserApiKeyFromUserApiKeysRouteDocument,
  "\n  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {\n    deleteUserApiKey(id: $id) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteUserApiKeyFromUserApiKeysRouteDocument,
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
  "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n":
    types.GetWorkspacesFromUserWorkspacesRouteDocument,
  "\n  mutation acceptInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.AcceptInvitationFromUserWorkspacesRouteDocument,
  "\n  mutation rejectInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.RejectInvitationFromUserWorkspacesRouteDocument,
  "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentWorkspace {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n":
    types.GetApiKeysFromApiKeysRouteDocument,
  "\n  mutation createWorkspaceApiKeyFromApiKeysRoute(\n    $input: CreateWorkspaceApiKeyInput!\n  ) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        workspaceId\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n":
    types.CreateWorkspaceApiKeyFromApiKeysRouteDocument,
  "\n  mutation updateWorkspaceApiKeyFromApiKeysRoute(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.UpdateWorkspaceApiKeyFromApiKeysRouteDocument,
  "\n  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n":
    types.DeleteWorkspaceApiKeyFromApiKeysRouteDocument,
  "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentMember {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n":
    types.GetCurrentWorkspaceFromWorkspaceLayoutDocument,
  "\n  mutation setMemberPermissionsFromMemberRoute(\n    $id: ID!\n    $input: SetMemberPermissionsInput!\n  ) {\n    setMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetMemberPermissionsFromMemberRouteDocument,
  "\n  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateMemberFromMemberRouteDocument,
  "\n  mutation setMemberRolesFromMemberRoute(\n    $id: ID!\n    $input: SetMemberRolesInput!\n  ) {\n    setMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.SetMemberRolesFromMemberRouteDocument,
  "\n  query getMemberFromMemberRoute($id: ID!) {\n    member(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n":
    types.GetMemberFromMemberRouteDocument,
  "\n  mutation removeMemberFromMemberRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n":
    types.RemoveMemberFromMemberRouteDocument,
  "\n  query getRolesFromInviteMemberDialog {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n":
    types.GetRolesFromInviteMemberDialogDocument,
  "\n  mutation createInvitationFromInviteMemberDialog(\n    $input: CreateInvitationInput!\n  ) {\n    createInvitation(input: $input) {\n      id\n    }\n  }\n":
    types.CreateInvitationFromInviteMemberDialogDocument,
  "\n  query getMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: MemberFilter\n    $orderBy: MemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: InvitationFilter\n    $includeInvitations: Boolean! = false\n  ) {\n    currentWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n":
    types.GetMembersFromMembersRouteDocument,
  "\n  mutation cancelInvitationFromMembersRoute($id: ID!) {\n    cancelInvitation(id: $id) {\n      id\n    }\n  }\n":
    types.CancelInvitationFromMembersRouteDocument,
  "\n  mutation removeMemberFromMembersRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n":
    types.RemoveMemberFromMembersRouteDocument,
  "\n  mutation updateMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateMemberInput!\n  ) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateMemberStatusFromMembersRouteDocument,
  "\n  mutation updateWorkspaceFromSettingsRoute(\n    $id: ID!\n    $input: UpdateWorkspaceInput!\n  ) {\n    updateWorkspace(id: $id, input: $input) {\n      id\n    }\n  }\n":
    types.UpdateWorkspaceFromSettingsRouteDocument,
  "\n  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {\n    deleteWorkspace(id: $id) {\n      id\n    }\n  }\n":
    types.DeleteWorkspaceFromSettingsRouteDocument,
  "\n  mutation leaveWorkspaceFromSettingsRoute {\n    leaveWorkspace {\n      memberId\n    }\n  }\n":
    types.LeaveWorkspaceFromSettingsRouteDocument,
  "\n  mutation createWorkspaceFromCreateWorkspaceForm(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceFromCreateWorkspaceFormDocument,
  "\n  mutation createWorkspaceFromCreateWorkspaceRoute(\n    $input: CreateWorkspaceInput!\n  ) {\n    createWorkspace(input: $input) {\n      id\n    }\n  }\n":
    types.CreateWorkspaceFromCreateWorkspaceRouteDocument,
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
  "\n  query getInvitationFromInviteRoute($id: ID!) {\n    invitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n":
    types.GetInvitationFromInviteRouteDocument,
  "\n  mutation acceptInvitationFromInviteRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n":
    types.AcceptInvitationFromInviteRouteDocument,
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
  source: "\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUsersFromUsersRoute(\n    $first: Int\n    $last: Int\n    $after: String\n    $before: String\n    $filter: UserFilter\n    $query: String\n    $orderBy: UserOrder\n  ) {\n    users(\n      first: $first\n      last: $last\n      after: $after\n      before: $before\n      filter: $filter\n      query: $query\n      orderBy: $orderBy\n    ) {\n      edges {\n        node {\n          id\n          name\n          email\n          emailVerified\n          banned\n          createdAt\n        }\n      }\n      totalCount\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createUserFromUsersRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createUserFromUsersRoute($input: CreateUserInput!) {\n    createUser(input: $input) {\n      id\n    }\n  }\n"];
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
  source: "\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getUserApiKeysFromUserApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: UserApiKeyFilter\n    $orderBy: UserApiKeyOrder\n    $query: String\n  ) {\n    userApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentUser {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createUserApiKeyFromUserApiKeysRoute(\n    $input: CreateUserApiKeyInput!\n  ) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createUserApiKeyFromUserApiKeysRoute(\n    $input: CreateUserApiKeyInput!\n  ) {\n    createUserApiKey(input: $input) {\n      apiKey\n      entity {\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateUserApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateUserApiKeyFromUserApiKeysRoute(\n    $id: ID!\n    $input: UpdateUserApiKeyInput!\n  ) {\n    updateUserApiKey(id: $id, input: $input) {\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
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
  source: "\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getWorkspacesFromUserWorkspacesRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $orderBy: WorkspaceOrder\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n  ) {\n    currentUser {\n      workspaces(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n      ) {\n        edges {\n          node {\n            id\n            name\n            createdAt\n            updatedAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentUser {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            expiresAt\n            workspace {\n              id\n              name\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation acceptInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation acceptInvitationFromUserWorkspacesRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation rejectInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation rejectInvitationFromUserWorkspacesRoute($id: ID!) {\n    rejectInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentWorkspace {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getApiKeysFromApiKeysRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: WorkspaceApiKeyFilter\n    $orderBy: WorkspaceApiKeyOrder\n    $query: String\n  ) {\n    workspaceApiKeyPermissions {\n      permission\n      grantable\n      default\n    }\n    currentWorkspace {\n      apiKeys(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            name\n            start\n            prefix\n            enabled\n            permissions\n            createdAt\n            lastUsedAt\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createWorkspaceApiKeyFromApiKeysRoute(\n    $input: CreateWorkspaceApiKeyInput!\n  ) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        workspaceId\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n",
): (typeof documents)["\n  mutation createWorkspaceApiKeyFromApiKeysRoute(\n    $input: CreateWorkspaceApiKeyInput!\n  ) {\n    createWorkspaceApiKey(input: $input) {\n      apiKey\n      entity {\n        workspaceId\n        id\n        name\n        start\n        prefix\n        enabled\n        permissions\n        createdAt\n        lastUsedAt\n        expiresAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateWorkspaceApiKeyFromApiKeysRoute(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation updateWorkspaceApiKeyFromApiKeysRoute(\n    $id: ID!\n    $input: UpdateWorkspaceApiKeyInput!\n  ) {\n    updateWorkspaceApiKey(id: $id, input: $input) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n",
): (typeof documents)["\n  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {\n    deleteWorkspaceApiKey(id: $id) {\n      workspaceId\n      id\n      name\n      start\n      prefix\n      enabled\n      permissions\n      createdAt\n      lastUsedAt\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentMember {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n",
): (typeof documents)["\n  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {\n    workspace(id: $workspaceId) {\n      id\n      name\n      createdAt\n      updatedAt\n    }\n    currentMember {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    currentAbilityRules {\n      actions\n      subjects\n      fields\n      conditions\n      inverted\n      reason\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setMemberPermissionsFromMemberRoute(\n    $id: ID!\n    $input: SetMemberPermissionsInput!\n  ) {\n    setMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setMemberPermissionsFromMemberRoute(\n    $id: ID!\n    $input: SetMemberPermissionsInput!\n  ) {\n    setMemberPermissions(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation setMemberRolesFromMemberRoute(\n    $id: ID!\n    $input: SetMemberRolesInput!\n  ) {\n    setMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation setMemberRolesFromMemberRoute(\n    $id: ID!\n    $input: SetMemberRolesInput!\n  ) {\n    setMemberRoles(id: $id, input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getMemberFromMemberRoute($id: ID!) {\n    member(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getMemberFromMemberRoute($id: ID!) {\n    member(id: $id) {\n      workspaceId\n      id\n      roles\n      permissions\n      status\n      name\n      email\n    }\n    workspaceRoles {\n      role\n      grantable\n    }\n    workspacePermissions {\n      permission\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation removeMemberFromMemberRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation removeMemberFromMemberRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getRolesFromInviteMemberDialog {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n",
): (typeof documents)["\n  query getRolesFromInviteMemberDialog {\n    workspaceRoles {\n      role\n      grantable\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation createInvitationFromInviteMemberDialog(\n    $input: CreateInvitationInput!\n  ) {\n    createInvitation(input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation createInvitationFromInviteMemberDialog(\n    $input: CreateInvitationInput!\n  ) {\n    createInvitation(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query getMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: MemberFilter\n    $orderBy: MemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: InvitationFilter\n    $includeInvitations: Boolean! = false\n  ) {\n    currentWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getMembersFromMembersRoute(\n    $after: String\n    $before: String\n    $first: Int\n    $last: Int\n    $filter: MemberFilter\n    $orderBy: MemberOrder\n    $query: String\n    $invitationFirst: Int\n    $invitationLast: Int\n    $invitationAfter: String\n    $invitationBefore: String\n    $invitationFilter: InvitationFilter\n    $includeInvitations: Boolean! = false\n  ) {\n    currentWorkspace {\n      members(\n        after: $after\n        before: $before\n        first: $first\n        last: $last\n        orderBy: $orderBy\n        filter: $filter\n        query: $query\n      ) {\n        edges {\n          node {\n            workspaceId\n            id\n            roles\n            status\n            createdAt\n            name\n            email\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n          hasPreviousPage\n          startCursor\n        }\n      }\n    }\n    currentWorkspace {\n      invitations(\n        first: $invitationFirst\n        last: $invitationLast\n        after: $invitationAfter\n        before: $invitationBefore\n        filter: $invitationFilter\n        orderBy: { field: CREATED_AT, direction: DESC }\n      ) @include(if: $includeInvitations) {\n        edges {\n          node {\n            workspaceId\n            id\n            email\n            roles\n            status\n            expiresAt\n          }\n        }\n        pageInfo {\n          endCursor\n          startCursor\n          hasNextPage\n          hasPreviousPage\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation cancelInvitationFromMembersRoute($id: ID!) {\n    cancelInvitation(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation cancelInvitationFromMembersRoute($id: ID!) {\n    cancelInvitation(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation removeMemberFromMembersRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation removeMemberFromMembersRoute($id: ID!) {\n    removeMember(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation updateMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateMemberInput!\n  ) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n",
): (typeof documents)["\n  mutation updateMemberStatusFromMembersRoute(\n    $id: ID!\n    $input: UpdateMemberInput!\n  ) {\n    updateMember(id: $id, input: $input) {\n      id\n    }\n  }\n"];
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
  source: "\n  query getInvitationFromInviteRoute($id: ID!) {\n    invitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n",
): (typeof documents)["\n  query getInvitationFromInviteRoute($id: ID!) {\n    invitation(id: $id) {\n      workspaceId\n      id\n      email\n      roles\n      status\n      expiresAt\n      workspace {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  mutation acceptInvitationFromInviteRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n",
): (typeof documents)["\n  mutation acceptInvitationFromInviteRoute($id: ID!) {\n    acceptInvitation(id: $id) {\n      id\n      memberId\n      workspaceId\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
