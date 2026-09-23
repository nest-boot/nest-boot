import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";

import { useCurrentUserContext } from "../../../contexts/current-user-context";
import type { UserPermission } from "@/lib/permissions";
import type { UserRole } from "@/gql/graphql";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
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
    return { title: t("admin:user.title") };
  },
});

function AdminUserPage() {
  const { t } = useTranslation();
  const { userId } = Route.useParams();
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
  const sessions = data?.user?.sessions?.edges.map(({ node }) => node) ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [permissions, setPermissions] = useState<Array<UserPermission>>([]);
  const [roles, setRoles] = useState<Array<UserRole>>([]);
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<string>();

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setEmailVerified(user.emailVerified);
    setPermissions(user.permissions);
    setRoles(user.roles);
    setBanReason(user.banReason ?? "");
  }, [user]);

  const [updateUser, { loading: updating }] = useMutation(
    UPDATE_USER_FROM_USER_ROUTE,
  );
  const [setUserPermissions, { loading: savingPermissions }] = useMutation(
    SET_USER_PERMISSIONS_FROM_USER_ROUTE,
  );
  const [setUserRoles, { loading: savingRole }] = useMutation(
    SET_USER_ROLES_FROM_USER_ROUTE,
  );
  const [banUser, { loading: banning }] = useMutation(BAN_USER_FROM_USER_ROUTE);
  const [unbanUser, { loading: unbanning }] = useMutation(
    UNBAN_USER_FROM_USER_ROUTE,
  );
  const [setUserPassword, { loading: settingPassword }] = useMutation(
    SET_USER_PASSWORD_FROM_USER_ROUTE,
  );
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

  if (loading) {
    return <Page variant="compact">{t("admin:user.loading")}</Page>;
  }
  if (!user) {
    return <Page variant="compact">{t("admin:user.not_found")}</Page>;
  }

  const userSubject = createAbilitySubject("User", user);
  const canSetRoles = ability.can("set-roles", userSubject);
  const canSetPermissions = ability.can("set-permissions", userSubject);
  const canUpdate = ability.can("update", userSubject);
  const canSetEmail = canUpdate && ability.can("set-email", userSubject);
  const canBan = ability.can("ban", userSubject);
  const canDelete = ability.can("delete", userSubject);
  const canSetPassword = ability.can("set-password", userSubject);
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
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : t("admin:failed"),
      });
    }
  };

  return (
    <Page variant="compact" data-testid="admin-user-page">
      <PageHeader>
        <Breadcrumbs />
        <PageTitle>{user.name}</PageTitle>
        <PageDescription>{user.email}</PageDescription>
        {user.id !== currentUser.id &&
        ability.can("impersonate", createAbilitySubject("User", user)) ? (
          <PageActions>
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
          </PageActions>
        ) : null}
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
                <FormLayout>
                  <FormLayoutItem>
                    <Input
                      label={t("admin:users.table.name")}
                      data-testid="admin-user-name"
                      disabled={!canUpdate}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <Input
                      type="email"
                      label={t("admin:users.table.email")}
                      data-testid="admin-user-email"
                      disabled={!canSetEmail}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <Field
                      orientation="horizontal"
                      data-disabled={!canSetEmail}
                    >
                      <Checkbox
                        id="admin-user-email-verified"
                        checked={emailVerified}
                        disabled={!canSetEmail}
                        onCheckedChange={setEmailVerified}
                      />
                      <FieldLabel htmlFor="admin-user-email-verified">
                        {t("admin:user.profile.email_verified")}
                      </FieldLabel>
                    </Field>
                  </FormLayoutItem>
                </FormLayout>
              </CardContent>
              <CardFooter>
                <Button
                  loading={updating}
                  data-testid="admin-user-profile-save"
                  disabled={!canUpdate}
                  onClick={() =>
                    run(
                      () =>
                        updateUser({
                          variables: {
                            id: userId,
                            input: {
                              name,
                              ...(canSetEmail ? { email, emailVerified } : {}),
                            },
                          },
                        }),
                      t("admin:user.profile.success"),
                    )
                  }
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
                <FormLayout>
                  <FormLayoutItem>
                    <RoleCheckboxGroup
                      label={t("admin:user.roles.label")}
                      options={data?.userRoles ?? []}
                      testIdPrefix="user-role"
                      value={roles}
                      disabled={!canSetRoles}
                      onValueChange={setRoles}
                    />
                  </FormLayoutItem>
                </FormLayout>
              </CardContent>
              <CardFooter>
                <Button
                  data-testid="admin-user-roles-save"
                  disabled={
                    !canSetRoles ||
                    roles.length === 0 ||
                    roles.some(
                      (role) =>
                        !data?.userRoles?.some(
                          (option) => option.role === role && option.grantable,
                        ),
                    )
                  }
                  loading={savingRole}
                  onClick={() =>
                    run(
                      () =>
                        setUserRoles({
                          variables: {
                            id: userId,
                            input: { roles },
                          },
                        }),
                      t("admin:user.roles.success"),
                    )
                  }
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
                <FormLayout>
                  <FormLayoutItem>
                    <PermissionCheckboxGroup
                      options={getPermissionOptions(
                        data?.userPermissions ?? [],
                      )}
                      value={permissions}
                      disabled={!canSetPermissions}
                      onChange={setPermissions}
                    />
                  </FormLayoutItem>
                </FormLayout>
              </CardContent>
              <CardFooter>
                <Button
                  loading={savingPermissions}
                  data-testid="admin-user-permissions-save"
                  disabled={
                    !canSetPermissions ||
                    permissions.some(
                      (permission) =>
                        !data?.userPermissions?.some(
                          (option) =>
                            option.permission === permission &&
                            option.grantable,
                        ),
                    )
                  }
                  onClick={() =>
                    run(
                      () =>
                        setUserPermissions({
                          variables: {
                            id: userId,
                            input: { permissions },
                          },
                        }),
                      t("admin:user.permissions.success"),
                    )
                  }
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
                <FormLayout>
                  <FormLayoutItem>
                    <Input
                      type="password"
                      label={t("admin:user.password.new")}
                      disabled={!canSetPassword}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </FormLayoutItem>
                </FormLayout>
              </CardContent>
              <CardFooter>
                <Button
                  disabled={!canSetPassword || newPassword.length < 8}
                  loading={settingPassword}
                  onClick={() =>
                    run(async () => {
                      await setUserPassword({
                        variables: {
                          id: userId,
                          input: { password: newPassword },
                        },
                      });
                      setNewPassword("");
                    }, t("admin:user.password.success"))
                  }
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
                <FormLayout>
                  <FormLayoutItem>
                    {user.banned ? (
                      <Badge color="red">
                        {user.banReason || t("admin:users.banned")}
                      </Badge>
                    ) : (
                      <Input
                        label={t("admin:user.ban.reason")}
                        disabled={!canBan}
                        value={banReason}
                        onChange={(event) => setBanReason(event.target.value)}
                      />
                    )}
                  </FormLayoutItem>
                </FormLayout>
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
                      onClick={() =>
                        run(
                          () =>
                            banUser({
                              variables: {
                                id: userId,
                                input: { reason: banReason || undefined },
                              },
                            }),
                          t("admin:user.ban.banned"),
                        )
                      }
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
                        await navigate({ to: "/admin/users" });
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
