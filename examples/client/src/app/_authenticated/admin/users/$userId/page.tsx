import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { t } from "i18next";
import { toast } from "sonner";

import { useCurrentUserContext } from "../../../contexts/current-user-context";
import { UserRolesForm } from "./components/user-roles-form";
import { UserProfileForm } from "./components/user-profile-form";
import { UserPermissionsForm } from "./components/user-permissions-form";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { usePasswordPolicy } from "@/hooks/use-password-policy";
import { useAbility } from "@/contexts/ability-context";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
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
  const { passwordSchema } = usePasswordPolicy();
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
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<string>();

  useEffect(() => {
    setBanReason("");
    setNewPassword("");
  }, [userId]);

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

  if (loading && !user) {
    return <Page>{t("admin:user.loading")}</Page>;
  }
  if (!user) {
    return <Page>{t("admin:user.not_found")}</Page>;
  }

  const userSubject = createAbilitySubject("User", user);
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
      await refreshAfterMutation(() => refetch());
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
        <UserRolesForm
          key={user.id}
          user={user}
          run={run}
          options={data?.userRoles ?? []}
        />

        <UserProfileForm key={user.id} user={user} run={run} />

        <UserPermissionsForm
          key={user.id}
          user={user}
          run={run}
          options={data?.userPermissions ?? []}
        />

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
                data-testid="admin-user-sessions-more"
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
              disabled={!canSetPassword}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <Button
              disabled={
                !canSetPassword ||
                !passwordSchema.safeParse(newPassword).success
              }
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
              </>
            ) : (
              <>
                <Input
                  label={t("admin:user.ban.reason")}
                  disabled={!canBan}
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                />
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
              </>
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
                try {
                  await deleteUser({ variables: { id: userId } });
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : t("admin:failed"),
                  );
                  return;
                }
                toast.success(t("admin:user.delete.success"));
                await refreshAfterMutation(() =>
                  navigate({ to: "/admin/users" }),
                );
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
