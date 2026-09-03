import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";
import { t } from "i18next";
import { toast } from "sonner";
import { z } from "zod";
import type { FormEvent } from "react";

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

export const Route = createFileRoute("/_authenticated/user/security/")({
  component: UserSecurityComponent,
  beforeLoad: () => ({ title: t("user:security.title") }),
});

function UserSecurityComponent() {
  const {
    data: sessionData,
    loading: sessionsLoading,
    refetch,
  } = useQuery(GET_SESSIONS_FROM_USER_SECURITY);
  const [changePassword] = useMutation(CHANGE_PASSWORD_FROM_USER_SECURITY);
  const [revokeSession] = useMutation(REVOKE_SESSION_FROM_USER_SECURITY);
  const [revokeOtherSessionList] = useMutation(
    REVOKE_OTHER_SESSIONS_FROM_USER_SECURITY,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string>();
  const [revokingOthers, setRevokingOthers] = useState(false);
  const sessions = sessionData?.authSessions ?? [];
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
