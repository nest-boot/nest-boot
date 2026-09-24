import { useCallback, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { z } from "zod";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";

import { useCurrentUserContext } from "../../../contexts/current-user-context";
import type { ResourceNavigationQueryOptions } from "@/hooks/use-resource-navigation";
import type { UserPermission } from "@/lib/permissions";
import type { UserRole } from "@/gql/graphql";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { RecordNavigation } from "@/components/record-navigation";
import { adminUserSearchSchema } from "@/schemas/admin-user-search";
import { adminUsersResourceKey } from "@/lib/resource-keys";
import { createConnectionCursor } from "@/lib/connection-cursor";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { Input } from "@/components/thread-ui/input";
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { graphql } from "@/gql";
import { getPermissionOptions } from "@/lib/permissions";
import { createAbilitySubject } from "@/lib/ability";

const GET_ADMIN_USER_NEIGHBORS = graphql(`
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

const GET_USER_FROM_USER_ROUTE = graphql(`
  query getUserFromUserRoute(
    $id: ID!
    $sessionsAfter: String
    $includeSessions: Boolean! = false
    $includeRoles: Boolean! = false
    $includePermissions: Boolean! = false
  ) {
    user(id: $id) {
      id
      name
      email
      emailVerified
      image
      roles
      permissions
      banned
      banReason
      banExpiresAt
      createdAt
      updatedAt
      sessions(
        first: 20
        after: $sessionsAfter
        orderBy: { field: CREATED_AT, direction: DESC }
      ) @include(if: $includeSessions) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            expiresAt
            ipAddress
            userAgent
            createdAt
          }
        }
      }
    }
    userRoles @include(if: $includeRoles) {
      role
      grantable
    }
    userPermissions @include(if: $includePermissions) {
      permission
      grantable
    }
  }
`);

const UPDATE_USER_FROM_USER_ROUTE = graphql(`
  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
    }
  }
`);

const SET_USER_PERMISSIONS_FROM_USER_ROUTE = graphql(`
  mutation setUserPermissionsFromUserRoute(
    $id: ID!
    $input: SetUserPermissionsInput!
  ) {
    setUserPermissions(id: $id, input: $input) {
      id
    }
  }
`);

const SET_USER_ROLES_FROM_USER_ROUTE = graphql(`
  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {
    setUserRoles(id: $id, input: $input) {
      id
    }
  }
`);

const BAN_USER_FROM_USER_ROUTE = graphql(`
  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {
    banUser(id: $id, input: $input) {
      id
    }
  }
`);

const UNBAN_USER_FROM_USER_ROUTE = graphql(`
  mutation unbanUserFromUserRoute($id: ID!) {
    unbanUser(id: $id) {
      id
    }
  }
`);

const SET_USER_PASSWORD_FROM_USER_ROUTE = graphql(`
  mutation setUserPasswordFromUserRoute(
    $id: ID!
    $input: SetUserPasswordInput!
  ) {
    setUserPassword(id: $id, input: $input)
  }
`);

const REVOKE_USER_SESSION_FROM_USER_ROUTE = graphql(`
  mutation revokeUserSessionFromUserRoute($userId: ID!, $id: ID!) {
    revokeSession(userId: $userId, id: $id)
  }
`);

const REVOKE_USER_SESSIONS_FROM_USER_ROUTE = graphql(`
  mutation revokeUserSessionsFromUserRoute($userId: ID!) {
    revokeUserSessions(userId: $userId)
  }
`);

const DELETE_USER_FROM_USER_ROUTE = graphql(`
  mutation deleteUserFromUserRoute($id: ID!) {
    deleteUser(id: $id) {
      id
    }
  }
`);

const IMPERSONATE_USER_FROM_USER_ROUTE = graphql(`
  mutation impersonateUserFromUserRoute($id: ID!) {
    impersonateUser(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/admin/users/$userId/")({
  component: AdminUserPage,
  beforeLoad: async ({
    context: { ability, apolloClient },
    params: { userId },
  }) => {
    if (!ability.can("read", "User")) throw redirect({ to: "/admin/users" });
    const { data } = await apolloClient.query({
      query: GET_USER_FROM_USER_ROUTE,
      variables: { id: userId },
    });
    if (
      !data?.user ||
      !ability.can("read", createAbilitySubject("User", data.user))
    )
      throw redirect({ to: "/admin/users" });
    return { title: t("admin:user.title"), user: data.user };
  },
});

function AdminUserPage() {
  const { userId } = Route.useParams();
  return <AdminUserDetails key={userId} />;
}

function AdminUserDetails() {
  const { t } = useTranslation();
  const { userId } = Route.useParams();
  const { user: initialUser } = Route.useRouteContext();
  const navigate = useNavigate();
  const currentUser = useCurrentUserContext();
  const ability = useAbility();
  const { data, loading, refetch, fetchMore } = useQuery(
    GET_USER_FROM_USER_ROUTE,
    {
      fetchPolicy: "network-only",
      variables: {
        id: userId,
        includeSessions:
          currentUser.id === userId || ability.can("read", "Session"),
        includeRoles: ability.can("set-roles", "User"),
        includePermissions: ability.can("set-permissions", "User"),
      },
    },
  );
  const user = data?.user;
  const navigationRecord = user ?? initialUser;
  const [loadNeighbors] = useLazyQuery(GET_ADMIN_USER_NEIGHBORS, {
    fetchPolicy: "network-only",
  });
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...adminUsersResourceKey],
    searchSchema: adminUserSearchSchema,
    query: useCallback(
      async ({
        search,
      }: ResourceNavigationQueryOptions<typeof adminUserSearchSchema>) => {
        const { query, filter, orderBy } =
          createConnectionQueryVariables(search);
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor: createConnectionCursor(navigationRecord, search),
          },
        });
        if (!data) return undefined;
        return {
          previousEdge: data.previous.edges[0],
          nextEdge: data.next.edges[0],
        };
      },
      [navigationRecord, loadNeighbors],
    ),
  });
  const { previousEdge, nextEdge, backSearch } = navigation;
  const sessions = data?.user?.sessions?.edges.map(({ node }) => node) ?? [];
  const [revokingSessionId, setRevokingSessionId] = useState<string>();

  const [updateUser] = useMutation(UPDATE_USER_FROM_USER_ROUTE);
  const [setUserPermissions] = useMutation(
    SET_USER_PERMISSIONS_FROM_USER_ROUTE,
  );
  const [setUserRoles] = useMutation(SET_USER_ROLES_FROM_USER_ROUTE);
  const [banUser] = useMutation(BAN_USER_FROM_USER_ROUTE);
  const [unbanUser, { loading: unbanning }] = useMutation(
    UNBAN_USER_FROM_USER_ROUTE,
  );
  const [setUserPassword] = useMutation(SET_USER_PASSWORD_FROM_USER_ROUTE);
  const [revokeSession] = useMutation(REVOKE_USER_SESSION_FROM_USER_ROUTE);
  const [revokeUserSessions, { loading: revokingSessions }] = useMutation(
    REVOKE_USER_SESSIONS_FROM_USER_ROUTE,
  );
  const [deleteUser, { loading: deleting }] = useMutation(
    DELETE_USER_FROM_USER_ROUTE,
  );
  const [impersonateUser, { loading: impersonating }] = useMutation(
    IMPERSONATE_USER_FROM_USER_ROUTE,
  );

  const userSubject = user ? createAbilitySubject("User", user) : undefined;
  const canSetRoles = !!userSubject && ability.can("set-roles", userSubject);
  const canSetPermissions =
    !!userSubject && ability.can("set-permissions", userSubject);
  const canUpdate = !!userSubject && ability.can("update", userSubject);
  const canSetEmail =
    !!userSubject && canUpdate && ability.can("set-email", userSubject);
  const canBan = !!userSubject && ability.can("ban", userSubject);
  const canDelete = !!userSubject && ability.can("delete", userSubject);
  const canSetPassword =
    !!userSubject && ability.can("set-password", userSubject);
  const canRevokeSessions = ability.can("revoke", "Session");

  const run = async (operation: () => Promise<unknown>, message: string) => {
    try {
      await operation();
      if (userId === currentUser.id) {
        // Rebuild auth providers; self-updates may revoke abilities or the session.
        window.location.assign("/user/workspaces");
        return;
      }
      await refetch();
      toast.add({ type: "success", title: message });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("admin:failed");
      toast.add({ type: "error", title: message });
      return message;
    }
  };

  const canGrantRoles = (roles: Array<UserRole>) =>
    roles.length > 0 &&
    roles.every((role) =>
      data?.userRoles?.some(
        (option) => option.role === role && option.grantable,
      ),
    );
  const canGrantPermissions = (permissions: Array<UserPermission>) =>
    permissions.every((permission) =>
      data?.userPermissions?.some(
        (option) => option.permission === permission && option.grantable,
      ),
    );

  const profileForm = useForm({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      emailVerified: user?.emailVerified ?? false,
    },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, t("auth:form.name.required")),
        email: z.string().email(t("auth:form.email.invalid")),
        emailVerified: z.boolean(),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canUpdate) return;
      const error = await run(
        () =>
          updateUser({
            variables: {
              id: userId,
              input: {
                name: value.name,
                ...(canSetEmail
                  ? { email: value.email, emailVerified: value.emailVerified }
                  : {}),
              },
            },
          }),
        t("admin:user.profile.success"),
      );
      if (error) formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      else formApi.reset(value);
    },
  });
  const rolesForm = useForm({
    defaultValues: { roles: user?.roles ?? [] },
    validators: {
      onSubmit: ({ value }) =>
        canGrantRoles(value.roles)
          ? undefined
          : { fields: { roles: t("admin:user.roles.invalid") } },
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canSetRoles || !canGrantRoles(value.roles)) return;
      const error = await run(
        () => setUserRoles({ variables: { id: userId, input: value } }),
        t("admin:user.roles.success"),
      );
      if (error) formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      else formApi.reset(value);
    },
  });
  const permissionsForm = useForm({
    defaultValues: { permissions: user?.permissions ?? [] },
    validators: {
      onSubmit: ({ value }) =>
        canGrantPermissions(value.permissions)
          ? undefined
          : { fields: { permissions: t("admin:user.permissions.invalid") } },
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canSetPermissions || !canGrantPermissions(value.permissions)) return;
      const error = await run(
        () => setUserPermissions({ variables: { id: userId, input: value } }),
        t("admin:user.permissions.success"),
      );
      if (error) formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      else formApi.reset(value);
    },
  });
  const passwordForm = useForm({
    defaultValues: { password: "" },
    validators: {
      onSubmit: z.object({
        password: z.string().min(8, t("auth:form.password.min")),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canSetPassword) return;
      const error = await run(
        () => setUserPassword({ variables: { id: userId, input: value } }),
        t("admin:user.password.success"),
      );
      if (error) formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      else formApi.reset();
    },
  });
  const banForm = useForm({
    defaultValues: { reason: user?.banReason ?? "" },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canBan || userId === currentUser.id || user?.banned) return;
      const error = await run(
        () =>
          banUser({
            variables: {
              id: userId,
              input: { reason: value.reason || undefined },
            },
          }),
        t("admin:user.ban.banned"),
      );
      if (error) formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      else formApi.reset(value);
    },
  });
  const updating = useStore(profileForm.store, (state) => state.isSubmitting);
  const savingRole = useStore(rolesForm.store, (state) => state.isSubmitting);
  const savingPermissions = useStore(
    permissionsForm.store,
    (state) => state.isSubmitting,
  );
  const settingPassword = useStore(
    passwordForm.store,
    (state) => state.isSubmitting,
  );
  const banning = useStore(banForm.store, (state) => state.isSubmitting);
  const roles = useStore(rolesForm.store, (state) => state.values.roles);
  const permissions = useStore(
    permissionsForm.store,
    (state) => state.values.permissions,
  );
  const newPassword = useStore(
    passwordForm.store,
    (state) => state.values.password,
  );

  if (loading) {
    return <Page variant="compact">{t("admin:user.loading")}</Page>;
  }
  if (!user) {
    return <Page variant="compact">{t("admin:user.not_found")}</Page>;
  }

  return (
    <Page variant="compact" data-testid="admin-user-page">
      <PageHeader>
        <Breadcrumbs searchByPath={{ "/admin/users": backSearch }} />
        <PageTitle>{user.name}</PageTitle>
        <PageDescription>{user.email}</PageDescription>
        <PageActions>
          {user.id !== currentUser.id &&
          ability.can("impersonate", createAbilitySubject("User", user)) ? (
            <Button
              variant="outline"
              loading={impersonating}
              data-testid="admin-impersonate-user"
              onClick={async () => {
                try {
                  await impersonateUser({ variables: { id: user.id } });
                  window.location.assign("/user");
                } catch (error) {
                  toast.add({
                    type: "error",
                    title:
                      error instanceof Error
                        ? error.message
                        : t("admin:impersonation.failed"),
                  });
                }
              }}
            >
              {t("admin:impersonation.start")}
            </Button>
          ) : null}
          <RecordNavigation
            testIdPrefix="admin-user"
            previousPath={
              previousEdge ? `/admin/users/${previousEdge.node.id}` : undefined
            }
            nextPath={nextEdge ? `/admin/users/${nextEdge.node.id}` : undefined}
            failed={Boolean(navigation.error)}
            onRetry={() => {
              void navigation.refetch().catch(() => undefined);
            }}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <PageLayout>
          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("admin:user.profile.title")}</CardTitle>
                <CardDescription>
                  {t("admin:user.profile.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="admin-user-profile-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (profileForm.state.isSubmitting) return;
                    profileForm.setErrorMap({ onSubmit: undefined });
                    profileForm.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      <profileForm.Field name="name">
                        {(field) => (
                          <Input
                            label={t("admin:users.table.name")}
                            data-testid="admin-user-name"
                            disabled={!canUpdate}
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            error={getFormErrorMessage(field.state.meta.errors)}
                          />
                        )}
                      </profileForm.Field>
                    </FormLayoutItem>
                    <FormLayoutItem>
                      <profileForm.Field name="email">
                        {(field) => (
                          <Input
                            type="email"
                            label={t("admin:users.table.email")}
                            data-testid="admin-user-email"
                            disabled={!canSetEmail}
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            error={getFormErrorMessage(field.state.meta.errors)}
                          />
                        )}
                      </profileForm.Field>
                    </FormLayoutItem>
                    <FormLayoutItem>
                      <Field
                        orientation="horizontal"
                        data-disabled={!canSetEmail}
                      >
                        <profileForm.Field name="emailVerified">
                          {(field) => (
                            <Checkbox
                              id="admin-user-email-verified"
                              checked={field.state.value}
                              disabled={!canSetEmail}
                              onCheckedChange={field.handleChange}
                            />
                          )}
                        </profileForm.Field>
                        <FieldLabel htmlFor="admin-user-email-verified">
                          {t("admin:user.profile.email_verified")}
                        </FieldLabel>
                      </Field>
                    </FormLayoutItem>
                    <profileForm.Subscribe
                      selector={(state) => getFormErrorMessage(state.errors)}
                    >
                      {(error) =>
                        error ? (
                          <FormLayoutItem>
                            <FieldError>{error}</FieldError>
                          </FormLayoutItem>
                        ) : null
                      }
                    </profileForm.Subscribe>
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  loading={updating}
                  data-testid="admin-user-profile-save"
                  disabled={!canUpdate}
                  type="submit"
                  form="admin-user-profile-form"
                >
                  {t("action.save")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("admin:user.roles.title")}</CardTitle>
                <CardDescription>
                  {t("admin:user.roles.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="admin-user-roles-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (rolesForm.state.isSubmitting) return;
                    rolesForm.setErrorMap({ onSubmit: undefined });
                    rolesForm.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      <rolesForm.Field name="roles">
                        {(field) => (
                          <>
                            <RoleCheckboxGroup
                              label={t("admin:user.roles.label")}
                              options={data?.userRoles ?? []}
                              value={field.state.value}
                              disabled={!canSetRoles}
                              onValueChange={field.handleChange}
                            />
                            <FieldError>
                              {getFormErrorMessage(field.state.meta.errors)}
                            </FieldError>
                          </>
                        )}
                      </rolesForm.Field>
                    </FormLayoutItem>
                    <rolesForm.Subscribe
                      selector={(state) => getFormErrorMessage(state.errors)}
                    >
                      {(error) =>
                        error ? (
                          <FormLayoutItem>
                            <FieldError>{error}</FieldError>
                          </FormLayoutItem>
                        ) : null
                      }
                    </rolesForm.Subscribe>
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  data-testid="admin-user-roles-save"
                  disabled={!canSetRoles || !canGrantRoles(roles)}
                  loading={savingRole}
                  type="submit"
                  form="admin-user-roles-form"
                >
                  {t("action.save")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("admin:user.permissions.title")}</CardTitle>
                <CardDescription>
                  {t("admin:user.permissions.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="admin-user-permissions-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (permissionsForm.state.isSubmitting) return;
                    permissionsForm.setErrorMap({ onSubmit: undefined });
                    permissionsForm.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      <permissionsForm.Field name="permissions">
                        {(field) => (
                          <>
                            <PermissionCheckboxGroup
                              options={getPermissionOptions(
                                data?.userPermissions ?? [],
                              )}
                              value={field.state.value}
                              disabled={!canSetPermissions}
                              onChange={field.handleChange}
                            />
                            <FieldError>
                              {getFormErrorMessage(field.state.meta.errors)}
                            </FieldError>
                          </>
                        )}
                      </permissionsForm.Field>
                    </FormLayoutItem>
                    <permissionsForm.Subscribe
                      selector={(state) => getFormErrorMessage(state.errors)}
                    >
                      {(error) =>
                        error ? (
                          <FormLayoutItem>
                            <FieldError>{error}</FieldError>
                          </FormLayoutItem>
                        ) : null
                      }
                    </permissionsForm.Subscribe>
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  loading={savingPermissions}
                  data-testid="admin-user-permissions-save"
                  disabled={
                    !canSetPermissions || !canGrantPermissions(permissions)
                  }
                  type="submit"
                  form="admin-user-permissions-form"
                >
                  {t("action.save")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("admin:user.sessions.title")}</CardTitle>
                <CardDescription>
                  {t("admin:user.sessions.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {session.userAgent ??
                            t("admin:user.sessions.unknown")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {session.ipAddress ?? "—"} ·{" "}
                          {dayjs(session.createdAt).format("YYYY-MM-DD HH:mm")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`admin-user-session-revoke-${session.id}`}
                        loading={revokingSessionId === session.id}
                        disabled={!canRevokeSessions}
                        onClick={async () => {
                          setRevokingSessionId(session.id);
                          await run(
                            () =>
                              revokeSession({
                                variables: { userId, id: session.id },
                              }),
                            t("admin:user.sessions.revoked"),
                          );
                          setRevokingSessionId(undefined);
                        }}
                      >
                        {t("admin:user.sessions.revoke")}
                      </Button>
                    </div>
                  ))}
                  {user?.sessions?.pageInfo.hasNextPage && (
                    <Button
                      variant="outline"
                      loading={loading}
                      onClick={() =>
                        fetchMore({
                          variables: {
                            sessionsAfter: user.sessions?.pageInfo.endCursor,
                          },
                          updateQuery: (previous, { fetchMoreResult }) => ({
                            ...fetchMoreResult,
                            user:
                              fetchMoreResult.user?.sessions &&
                              previous.user?.sessions
                                ? {
                                    ...fetchMoreResult.user,
                                    sessions: {
                                      ...fetchMoreResult.user.sessions,
                                      edges: [
                                        ...previous.user.sessions.edges,
                                        ...fetchMoreResult.user.sessions.edges,
                                      ],
                                    },
                                  }
                                : fetchMoreResult.user,
                          }),
                        })
                      }
                    >
                      {t("action.load_more")}
                    </Button>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  data-testid="admin-user-sessions-revoke"
                  disabled={!canRevokeSessions || sessions.length === 0}
                  loading={revokingSessions}
                  onClick={() =>
                    run(
                      () => revokeUserSessions({ variables: { userId } }),
                      t("admin:user.sessions.revoked_all"),
                    )
                  }
                >
                  {t("admin:user.sessions.revoke_all")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("admin:user.password.title")}</CardTitle>
                <CardDescription>
                  {t("admin:user.password.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="admin-user-password-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (passwordForm.state.isSubmitting) return;
                    passwordForm.setErrorMap({ onSubmit: undefined });
                    passwordForm.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      <passwordForm.Field name="password">
                        {(field) => (
                          <Input
                            type="password"
                            label={t("admin:user.password.new")}
                            disabled={!canSetPassword}
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            error={getFormErrorMessage(field.state.meta.errors)}
                          />
                        )}
                      </passwordForm.Field>
                    </FormLayoutItem>
                    <passwordForm.Subscribe
                      selector={(state) => getFormErrorMessage(state.errors)}
                    >
                      {(error) =>
                        error ? (
                          <FormLayoutItem>
                            <FieldError>{error}</FieldError>
                          </FormLayoutItem>
                        ) : null
                      }
                    </passwordForm.Subscribe>
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  disabled={!canSetPassword || newPassword.length < 8}
                  loading={settingPassword}
                  type="submit"
                  form="admin-user-password-form"
                >
                  {t("admin:user.password.action")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>
                  {user.banned
                    ? t("admin:user.ban.unban_title")
                    : t("admin:user.ban.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin:user.ban.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="admin-user-ban-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (banForm.state.isSubmitting) return;
                    banForm.setErrorMap({ onSubmit: undefined });
                    banForm.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      {user.banned ? (
                        <Badge color="red">
                          {user.banReason || t("admin:users.banned")}
                        </Badge>
                      ) : (
                        <banForm.Field name="reason">
                          {(field) => (
                            <Input
                              label={t("admin:user.ban.reason")}
                              disabled={!canBan}
                              value={field.state.value}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              error={getFormErrorMessage(
                                field.state.meta.errors,
                              )}
                            />
                          )}
                        </banForm.Field>
                      )}
                    </FormLayoutItem>
                    <banForm.Subscribe
                      selector={(state) => getFormErrorMessage(state.errors)}
                    >
                      {(error) =>
                        error ? (
                          <FormLayoutItem>
                            <FieldError>{error}</FieldError>
                          </FormLayoutItem>
                        ) : null
                      }
                    </banForm.Subscribe>
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <div className="flex flex-wrap gap-2">
                  {user.banned ? (
                    <Button
                      loading={unbanning}
                      disabled={!canBan}
                      onClick={() =>
                        run(
                          () => unbanUser({ variables: { id: userId } }),
                          t("admin:user.ban.unbanned"),
                        )
                      }
                    >
                      {t("admin:user.ban.unban")}
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      disabled={!canBan || currentUser.id === userId}
                      loading={banning}
                      type="submit"
                      form="admin-user-ban-form"
                    >
                      {t("admin:user.ban.action")}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    disabled={!canDelete || currentUser.id === userId}
                    loading={deleting}
                    onClick={async () => {
                      const confirmed = await alertDialog({
                        title: t("admin:user.delete.confirm_title"),
                        description: t("admin:user.delete.confirm_description"),
                        confirmText: t("action.delete"),
                        cancelText: t("action.cancel"),
                        variant: "destructive",
                      });
                      if (!confirmed) return;
                      await run(async () => {
                        await deleteUser({ variables: { id: userId } });
                        await navigate({
                          to: "/admin/users",
                          search: backSearch,
                        });
                      }, t("admin:user.delete.success"));
                    }}
                  >
                    {t("admin:user.delete.action")}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </PageLayoutSection>
        </PageLayout>
      </PageContent>
    </Page>
  );
}
