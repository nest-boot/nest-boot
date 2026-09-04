import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { t } from "i18next";
import { toast } from "sonner";

import {
  useCurrentUserAbility,
  useCurrentUserContext,
} from "../../../contexts/current-user-context";
import type { UserPermission } from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";
import { Input } from "@/components/thread-ui/input";
import {
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { graphql } from "@/gql";
import {
  isUserPermission,
  userPermissionOptions,
  userPermissionValues,
} from "@/lib/permissions";
import { getRoleLabel } from "@/utils/get-role-label";
import { createAbilitySubject } from "@/lib/ability";

const GET_USER_FROM_USER_ROUTE = graphql(`
  query getUserFromUserRoute($id: ID!) {
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
    }
    userRoles {
      name
      permissions
    }
    userPermissions
    userSessions(userId: $id) {
      id
      token
      expiresAt
      ipAddress
      userAgent
      createdAt
    }
  }
`);

const UPDATE_USER_FROM_USER_ROUTE = graphql(`
  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      emailVerified
      image
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
      permissions
    }
  }
`);

const SET_USER_ROLES_FROM_USER_ROUTE = graphql(`
  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {
    setUserRoles(id: $id, input: $input) {
      id
      roles
    }
  }
`);

const BAN_USER_FROM_USER_ROUTE = graphql(`
  mutation banUserFromUserRoute($id: ID!, $input: BanUserInput) {
    banUser(id: $id, input: $input) {
      id
      banned
      banReason
      banExpiresAt
    }
  }
`);

const UNBAN_USER_FROM_USER_ROUTE = graphql(`
  mutation unbanUserFromUserRoute($id: ID!) {
    unbanUser(id: $id) {
      id
      banned
      banReason
      banExpiresAt
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
  mutation revokeUserSessionFromUserRoute($userId: ID!, $token: String!) {
    revokeUserSession(userId: $userId, token: $token)
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
  beforeLoad: () => ({ title: t("admin:user.title") }),
});

function AdminUserPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUserContext();
  const currentUserAbility = useCurrentUserAbility();
  const { data, loading, refetch } = useQuery(GET_USER_FROM_USER_ROUTE, {
    fetchPolicy: "network-only",
    variables: { id: userId },
  });
  const user = data?.user;
  const sessions = data?.userSessions ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [permissions, setPermissions] = useState<Array<UserPermission>>([]);
  const [roles, setRoles] = useState<Array<string>>([]);
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revokingToken, setRevokingToken] = useState<string>();

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setEmailVerified(user.emailVerified);
    setPermissions(user.permissions.filter(isUserPermission));
    setRoles(user.roles);
    setBanReason(user.banReason ?? "");
  }, [user]);

  const [updateUser, { loading: updating }] = useMutation(
    UPDATE_USER_FROM_USER_ROUTE,
  );
  const [setUserPermissions, { loading: savingPermissions }] = useMutation(
    SET_USER_PERMISSIONS_FROM_USER_ROUTE,
  );
  const [setUserRole, { loading: savingRole }] = useMutation(
    SET_USER_ROLES_FROM_USER_ROUTE,
  );
  const [banUser, { loading: banning }] = useMutation(BAN_USER_FROM_USER_ROUTE);
  const [unbanUser, { loading: unbanning }] = useMutation(
    UNBAN_USER_FROM_USER_ROUTE,
  );
  const [setUserPassword, { loading: settingPassword }] = useMutation(
    SET_USER_PASSWORD_FROM_USER_ROUTE,
  );
  const [revokeUserSession] = useMutation(REVOKE_USER_SESSION_FROM_USER_ROUTE);
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
    return <Page>{t("admin:user.loading")}</Page>;
  }
  if (!user) {
    return <Page>{t("admin:user.not_found")}</Page>;
  }

  const run = async (operation: () => Promise<unknown>, message: string) => {
    try {
      await operation();
      await refetch();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin:failed"));
    }
  };

  return (
    <Page data-testid="admin-user-page">
      <PageHeader>
        <PageTitle>{user.name}</PageTitle>
        <PageDescription>{user.email}</PageDescription>
        {user.id !== currentUser.id &&
        currentUserAbility.can(
          "impersonate",
          createAbilitySubject("User", user),
        ) ? (
          <Button
            variant="outline"
            loading={impersonating}
            data-testid="admin-impersonate-user"
            onClick={async () => {
              try {
                await impersonateUser({ variables: { id: user.id } });
                window.location.assign("/user");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("admin:impersonation.failed"),
                );
              }
            }}
          >
            {t("admin:impersonation.start")}
          </Button>
        ) : null}
      </PageHeader>
      <PageContent className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin:user.roles.title")}</CardTitle>
            <CardDescription>
              {t("admin:user.roles.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup
              label={t("admin:user.roles.label")}
              items={(data?.userRoles ?? []).map((role) => ({
                label: getRoleLabel(role.name),
                value: role.name,
              }))}
              value={roles}
              onValueChange={setRoles}
            />
            <Button
              disabled={roles.length === 0}
              loading={savingRole}
              onClick={() =>
                run(
                  () =>
                    setUserRole({
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin:user.profile.title")}</CardTitle>
            <CardDescription>
              {t("admin:user.profile.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t("admin:users.table.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              type="email"
              label={t("admin:users.table.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emailVerified}
                onChange={(event) => setEmailVerified(event.target.checked)}
              />
              {t("admin:user.profile.email_verified")}
            </label>
            <Button
              loading={updating}
              onClick={() =>
                run(
                  () =>
                    updateUser({
                      variables: {
                        id: userId,
                        input: { email, emailVerified, name },
                      },
                    }),
                  t("admin:user.profile.success"),
                )
              }
            >
              {t("action.save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin:user.permissions.title")}</CardTitle>
            <CardDescription>
              {t("admin:user.permissions.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PermissionCheckboxGroup
              options={userPermissionOptions.filter((option) =>
                data?.userPermissions.includes(option.value),
              )}
              value={permissions}
              onChange={setPermissions}
            />
            <Button
              loading={savingPermissions}
              onClick={() =>
                run(
                  () =>
                    setUserPermissions({
                      variables: {
                        id: userId,
                        input: {
                          permissions: permissions.filter((permission) =>
                            userPermissionValues.includes(permission),
                          ),
                        },
                      },
                    }),
                  t("admin:user.permissions.success"),
                )
              }
            >
              {t("action.save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin:user.sessions.title")}</CardTitle>
            <CardDescription>
              {t("admin:user.sessions.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {session.userAgent ?? t("admin:user.sessions.unknown")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {session.ipAddress ?? "—"} ·{" "}
                    {dayjs(session.createdAt).format("YYYY-MM-DD HH:mm")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={revokingToken === session.token}
                  onClick={async () => {
                    setRevokingToken(session.token);
                    await run(
                      () =>
                        revokeUserSession({
                          variables: { userId, token: session.token },
                        }),
                      t("admin:user.sessions.revoked"),
                    );
                    setRevokingToken(undefined);
                  }}
                >
                  {t("admin:user.sessions.revoke")}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={sessions.length === 0}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin:user.password.title")}</CardTitle>
            <CardDescription>
              {t("admin:user.password.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              label={t("admin:user.password.new")}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <Button
              disabled={newPassword.length < 8}
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
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              {user.banned
                ? t("admin:user.ban.unban_title")
                : t("admin:user.ban.title")}
            </CardTitle>
            <CardDescription>{t("admin:user.ban.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.banned ? (
              <>
                <Badge color="red">
                  {user.banReason || t("admin:users.banned")}
                </Badge>
                <Button
                  loading={unbanning}
                  onClick={() =>
                    run(
                      () => unbanUser({ variables: { id: userId } }),
                      t("admin:user.ban.unbanned"),
                    )
                  }
                >
                  {t("admin:user.ban.unban")}
                </Button>
              </>
            ) : (
              <>
                <Input
                  label={t("admin:user.ban.reason")}
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={currentUser.id === userId}
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
              </>
            )}
            <Button
              variant="destructive"
              disabled={currentUser.id === userId}
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
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
