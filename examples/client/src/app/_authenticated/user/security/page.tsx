import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";
import { t } from "i18next";
import { toast } from "sonner";
import { z } from "zod";
import type { FormEvent } from "react";

import { alertDialog } from "@/components/thread-ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { graphql } from "@/gql";

const CHANGE_PASSWORD_FROM_USER_SECURITY = graphql(`
  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {
    authChangePassword(input: $input) {
      token
    }
  }
`);

const GET_SESSIONS_FROM_USER_SECURITY = graphql(`
  query getSessionsFromUserSecurity {
    authSessions {
      id
      token
      current
      expiresAt
      ipAddress
      userAgent
      createdAt
    }
  }
`);

const REVOKE_SESSION_FROM_USER_SECURITY = graphql(`
  mutation revokeSessionFromUserSecurity($token: String!) {
    authRevokeSession(token: $token)
  }
`);

const REVOKE_OTHER_SESSIONS_FROM_USER_SECURITY = graphql(`
  mutation revokeOtherSessionsFromUserSecurity {
    authRevokeOtherSessions
  }
`);

const GET_ACCOUNTS_FROM_USER_SECURITY = graphql(`
  query getAccountsFromUserSecurity {
    authAccounts {
      id
      accountId
      issuer
      providerId
      scopes
      createdAt
    }
  }
`);

const UNLINK_ACCOUNT_FROM_USER_SECURITY = graphql(`
  mutation unlinkAccountFromUserSecurity($accountId: ID!) {
    authUnlinkAccount(accountId: $accountId)
  }
`);

const REFRESH_ACCOUNT_FROM_USER_SECURITY = graphql(`
  mutation refreshAccountFromUserSecurity($input: AuthAccountSelectorInput!) {
    authRefreshToken(input: $input) {
      accountId
      providerId
    }
  }
`);

const DELETE_USER_FROM_USER_SECURITY = graphql(`
  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {
    authDeleteUser(input: $input) {
      success
      message
    }
  }
`);

export const Route = createFileRoute("/_authenticated/user/security/")({
  component: UserSecurityComponent,
  beforeLoad: () => ({ title: t("user:security.title") }),
});

function UserSecurityComponent() {
  const navigate = useNavigate();
  const {
    data: sessionData,
    loading: sessionsLoading,
    refetch,
  } = useQuery(GET_SESSIONS_FROM_USER_SECURITY);
  const {
    data: accountData,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useQuery(GET_ACCOUNTS_FROM_USER_SECURITY);
  const [changePassword] = useMutation(CHANGE_PASSWORD_FROM_USER_SECURITY);
  const [revokeSession] = useMutation(REVOKE_SESSION_FROM_USER_SECURITY);
  const [revokeOtherSessionList] = useMutation(
    REVOKE_OTHER_SESSIONS_FROM_USER_SECURITY,
  );
  const [unlinkAccount] = useMutation(UNLINK_ACCOUNT_FROM_USER_SECURITY);
  const [refreshAccount] = useMutation(REFRESH_ACCOUNT_FROM_USER_SECURITY);
  const [deleteUser, { client }] = useMutation(DELETE_USER_FROM_USER_SECURITY);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string>();
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string>();
  const [refreshingAccountId, setRefreshingAccountId] = useState<string>();
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const sessions = sessionData?.authSessions ?? [];
  const accounts = accountData?.authAccounts ?? [];
  const otherSessionCount = sessions.filter(
    (session) => !session.current,
  ).length;

  const handleRevokeSession = async (token: string) => {
    setRevokingToken(token);
    try {
      const result = await revokeSession({ variables: { token } });
      if (!result.data?.authRevokeSession) {
        throw new Error(t("user:security.sessions.toast.revoke_failed"));
      }
      await refetch();
      toast.success(t("user:security.sessions.toast.revoked"));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("user:security.sessions.toast.revoke_failed"),
      );
    } finally {
      setRevokingToken(undefined);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingOthers(true);
    try {
      const result = await revokeOtherSessionList();
      if (!result.data?.authRevokeOtherSessions) {
        throw new Error(t("user:security.sessions.toast.revoke_failed"));
      }
      await refetch();
      toast.success(t("user:security.sessions.toast.others_revoked"));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("user:security.sessions.toast.revoke_failed"),
      );
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const parsed = createChangePasswordSchema().safeParse({
      confirmPassword,
      currentPassword,
      newPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword({
        variables: {
          input: {
            currentPassword: parsed.data.currentPassword,
            newPassword: parsed.data.newPassword,
            revokeOtherSessions,
          },
        },
      });

      if (!result.data?.authChangePassword) {
        throw new Error(t("user:security.toast.update_failed"));
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("user:security.toast.updated"));
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : t("user:security.toast.update_failed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAccount = async (accountId: string) => {
    const confirmed = await alertDialog({
      title: t("user:security.accounts.unlink_confirm_title"),
      description: t("user:security.accounts.unlink_confirm_description"),
      confirmText: t("user:security.accounts.unlink"),
      cancelText: t("action.cancel"),
      variant: "destructive",
    });
    if (!confirmed) return;

    setUnlinkingAccountId(accountId);
    try {
      const result = await unlinkAccount({ variables: { accountId } });
      if (!result.data?.authUnlinkAccount) {
        throw new Error(t("user:security.accounts.unlink_failed"));
      }
      await refetchAccounts();
      toast.success(t("user:security.accounts.unlinked"));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("user:security.accounts.unlink_failed"),
      );
    } finally {
      setUnlinkingAccountId(undefined);
    }
  };

  const handleRefreshAccount = async (accountId: string) => {
    setRefreshingAccountId(accountId);
    try {
      await refreshAccount({ variables: { input: { accountId } } });
      toast.success(t("user:security.accounts.refreshed"));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("user:security.accounts.refresh_failed"),
      );
    } finally {
      setRefreshingAccountId(undefined);
    }
  };

  const handleDeleteUser = async () => {
    const confirmed = await alertDialog({
      title: t("user:security.delete.confirm_title"),
      description: t("user:security.delete.confirm_description"),
      confirmText: t("user:security.delete.action"),
      cancelText: t("action.cancel"),
      variant: "destructive",
    });
    if (!confirmed) return;

    setDeletingUser(true);
    try {
      const result = await deleteUser({
        variables: { input: { password: deletePassword } },
      });
      if (!result.data?.authDeleteUser.success) {
        throw new Error(
          result.data?.authDeleteUser.message ||
            t("user:security.delete.failed"),
        );
      }
      await client.clearStore();
      await navigate({ to: "/auth/login", replace: true });
      toast.success(t("user:security.delete.success"));
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("user:security.delete.failed"),
      );
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <Page data-testid="user-security-page">
      <PageHeader>
        <PageTitle>{t("user:security.title")}</PageTitle>
        <PageDescription>{t("user:security.description")}</PageDescription>
      </PageHeader>

      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>{t("user:security.card.title")}</CardTitle>
            <CardDescription>
              {t("user:security.card.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldSet>
                <FieldGroup>
                  <Input
                    id="current-password"
                    data-testid="user-current-password"
                    type="password"
                    autoComplete="current-password"
                    label={t("user:security.form.current_password")}
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      setError(undefined);
                    }}
                  />
                  <Input
                    id="new-password"
                    data-testid="user-new-password"
                    type="password"
                    autoComplete="new-password"
                    label={t("user:security.form.new_password")}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError(undefined);
                    }}
                  />
                  <Input
                    id="confirm-password"
                    data-testid="user-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    label={t("user:security.form.confirm_password")}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError(undefined);
                    }}
                  />

                  <Field orientation="horizontal">
                    <Checkbox
                      id="revoke-other-sessions"
                      data-testid="user-revoke-other-sessions"
                      checked={revokeOtherSessions}
                      onCheckedChange={setRevokeOtherSessions}
                    />
                    <FieldLabel htmlFor="revoke-other-sessions">
                      {t("user:security.form.revoke_other_sessions")}
                    </FieldLabel>
                  </Field>

                  {error && (
                    <FieldDescription className="text-destructive">
                      {error}
                    </FieldDescription>
                  )}

                  <Field orientation="horizontal">
                    <Button
                      type="submit"
                      data-testid="user-change-password-submit"
                      loading={loading}
                    >
                      {t("user:security.form.submit")}
                    </Button>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </form>
          </CardContent>
        </Card>

        <Card data-testid="user-sessions-card">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>{t("user:security.sessions.title")}</CardTitle>
                <CardDescription>
                  {t("user:security.sessions.description")}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={otherSessionCount === 0}
                loading={revokingOthers}
                onClick={handleRevokeOtherSessions}
                data-testid="user-revoke-other-session-list"
              >
                {t("user:security.sessions.revoke_others")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <p className="text-muted-foreground text-sm">
                {t("user:security.sessions.loading")}
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("user:security.sessions.empty")}
              </p>
            ) : (
              <div className="divide-y" data-testid="user-session-list">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    data-testid="user-session-row"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <MonitorSmartphone className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-xl truncate text-sm font-medium">
                            {session.userAgent ??
                              t("user:security.sessions.unknown_device")}
                          </p>
                          {session.current && (
                            <Badge variant="secondary">
                              {t("user:security.sessions.current")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {session.ipAddress ??
                            t("user:security.sessions.unknown_ip")}
                          {" · "}
                          {t("user:security.sessions.created", {
                            date: formatSessionDate(session.createdAt),
                          })}
                          {" · "}
                          {t("user:security.sessions.expires", {
                            date: formatSessionDate(session.expiresAt),
                          })}
                        </p>
                      </div>
                    </div>
                    {!session.current && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={revokingToken === session.token}
                        onClick={() => handleRevokeSession(session.token)}
                        data-testid="user-revoke-session"
                      >
                        {t("user:security.sessions.revoke")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="user-accounts-card">
          <CardHeader>
            <CardTitle>{t("user:security.accounts.title")}</CardTitle>
            <CardDescription>
              {t("user:security.accounts.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <p className="text-muted-foreground text-sm">
                {t("user:security.accounts.loading")}
              </p>
            ) : (
              <div className="divide-y">
                {accounts.map((account) => {
                  const credential = account.providerId === "credential";
                  return (
                    <div
                      key={account.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                      data-testid={`user-account-${account.providerId}`}
                    >
                      <div>
                        <p className="font-medium capitalize">
                          {account.providerId}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {account.issuer} · {account.accountId}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!credential ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={refreshingAccountId === account.id}
                            onClick={() => handleRefreshAccount(account.id)}
                          >
                            {t("user:security.accounts.refresh")}
                          </Button>
                        ) : null}
                        {!credential && accounts.length > 1 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            loading={unlinkingAccountId === account.id}
                            onClick={() => handleUnlinkAccount(account.id)}
                          >
                            {t("user:security.accounts.unlink")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive" data-testid="user-delete-card">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("user:security.delete.title")}
            </CardTitle>
            <CardDescription>
              {t("user:security.delete.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              label={t("user:security.delete.password")}
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={!deletePassword}
              loading={deletingUser}
              onClick={handleDeleteUser}
              data-testid="user-delete-account"
            >
              {t("user:security.delete.action")}
            </Button>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}

function formatSessionDate(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function createChangePasswordSchema() {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t("user:security.form.current_required")),
      newPassword: z.string().min(8, t("auth:form.password.min")),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: t("auth:passwordReset.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
