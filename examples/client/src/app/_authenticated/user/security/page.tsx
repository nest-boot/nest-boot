import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";

import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { Page } from "@/components/thread-ui/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { graphql } from "@/gql";

const CHANGE_PASSWORD_FROM_USER_SECURITY = graphql(`
  mutation changePasswordFromUserSecurity($input: AuthChangePasswordInput!) {
    changeCurrentUserPassword(input: $input) {
      token
    }
  }
`);

const GET_SESSIONS_FROM_USER_SECURITY = graphql(`
  query getSessionsFromUserSecurity($after: String) {
    currentUser {
      id
      sessions(
        first: 20
        after: $after
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            current
            expiresAt
            ipAddress
            userAgent
            createdAt
          }
        }
      }
    }
  }
`);

const REVOKE_SESSION_FROM_USER_SECURITY = graphql(`
  mutation revokeSessionFromUserSecurity($id: ID!) {
    revokeCurrentUserSession(id: $id)
  }
`);

const REVOKE_OTHER_SESSIONS_FROM_USER_SECURITY = graphql(`
  mutation revokeOtherSessionsFromUserSecurity {
    revokeCurrentUserOtherSessions
  }
`);

const GET_ACCOUNTS_FROM_USER_SECURITY = graphql(`
  query getAccountsFromUserSecurity($after: String) {
    currentUser {
      id
      accounts(
        first: 20
        after: $after
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            accountId
            issuer
            providerId
            scopes
            createdAt
          }
        }
      }
    }
  }
`);

const GET_SOCIAL_PROVIDERS_FROM_USER_SECURITY = graphql(`
  query getSocialProvidersFromUserSecurity {
    socialProviders {
      id
      name
    }
  }
`);

const UNLINK_ACCOUNT_FROM_USER_SECURITY = graphql(`
  mutation unlinkAccountFromUserSecurity($id: ID!) {
    unlinkCurrentUserAccount(id: $id)
  }
`);

const LINK_ACCOUNT_FROM_USER_SECURITY = graphql(`
  mutation linkAccountFromUserSecurity($input: AuthLinkSocialAccountInput!) {
    linkCurrentUserAccount(input: $input) {
      url
      redirect
    }
  }
`);

const DELETE_USER_FROM_USER_SECURITY = graphql(`
  mutation deleteUserFromUserSecurity($input: AuthDeleteUserInput) {
    deleteCurrentUser(input: $input) {
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    data: sessionData,
    loading: sessionsLoading,
    fetchMore: fetchMoreSessions,
    refetch,
  } = useQuery(GET_SESSIONS_FROM_USER_SECURITY);
  const {
    data: accountData,
    loading: accountsLoading,
    fetchMore: fetchMoreAccounts,
    refetch: refetchAccounts,
  } = useQuery(GET_ACCOUNTS_FROM_USER_SECURITY);
  const { data: socialProviderData } = useQuery(
    GET_SOCIAL_PROVIDERS_FROM_USER_SECURITY,
  );
  const [changePassword] = useMutation(CHANGE_PASSWORD_FROM_USER_SECURITY);
  const [revokeSession] = useMutation(REVOKE_SESSION_FROM_USER_SECURITY);
  const [revokeOtherSessionList] = useMutation(
    REVOKE_OTHER_SESSIONS_FROM_USER_SECURITY,
  );
  const [unlinkAccount] = useMutation(UNLINK_ACCOUNT_FROM_USER_SECURITY);
  const [linkAccount] = useMutation(LINK_ACCOUNT_FROM_USER_SECURITY);
  const [deleteUser, { client }] = useMutation(DELETE_USER_FROM_USER_SECURITY);
  const [revokingSessionId, setRevokingSessionId] = useState<string>();
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string>();
  const [linkingProviderId, setLinkingProviderId] = useState<string>();
  const sessions =
    sessionData?.currentUser.sessions.edges.map(({ node }) => node) ?? [];
  const accounts =
    accountData?.currentUser.accounts.edges.map(({ node }) => node) ?? [];
  const socialProviders = socialProviderData?.socialProviders ?? [];
  const linkableProviders =
    accountData && !accountData.currentUser.accounts.pageInfo.hasNextPage
      ? socialProviders.filter(
          (provider) =>
            !accounts.some((account) => account.providerId === provider.id),
        )
      : [];
  const otherSessionCount = sessions.filter(
    (session) => !session.current,
  ).length;

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      const result = await revokeSession({ variables: { id: sessionId } });
      if (!result.data?.revokeCurrentUserSession) {
        throw new Error(t("user:security.sessions.toast.revoke_failed"));
      }
      await refetch();
      toast.add({
        type: "success",
        title: t("user:security.sessions.toast.revoked"),
      });
    } catch (cause) {
      toast.add({
        type: "error",
        title:
          cause instanceof Error
            ? cause.message
            : t("user:security.sessions.toast.revoke_failed"),
      });
    } finally {
      setRevokingSessionId(undefined);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingOthers(true);
    try {
      const result = await revokeOtherSessionList();
      if (!result.data?.revokeCurrentUserOtherSessions) {
        throw new Error(t("user:security.sessions.toast.revoke_failed"));
      }
      await refetch();
      toast.add({
        type: "success",
        title: t("user:security.sessions.toast.others_revoked"),
      });
    } catch (cause) {
      toast.add({
        type: "error",
        title:
          cause instanceof Error
            ? cause.message
            : t("user:security.sessions.toast.revoke_failed"),
      });
    } finally {
      setRevokingOthers(false);
    }
  };

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: true,
    },
    validators: { onSubmit: createChangePasswordSchema() },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await changePassword({
          variables: {
            input: {
              currentPassword: value.currentPassword,
              newPassword: value.newPassword,
              revokeOtherSessions: value.revokeOtherSessions,
            },
          },
        });

        if (!result.data?.changeCurrentUserPassword) {
          throw new Error(t("user:security.toast.update_failed"));
        }

        await refetch({ after: undefined });
        formApi.reset({
          ...value,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        toast.add({ type: "success", title: t("user:security.toast.updated") });
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : t("user:security.toast.update_failed");
        formApi.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.add({ type: "error", title: message });
      }
    },
  });
  const loading = useStore(passwordForm.store, (state) => state.isSubmitting);
  const error = useStore(passwordForm.store, (state) =>
    getFormErrorMessage(state.errors),
  );

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
      const result = await unlinkAccount({ variables: { id: accountId } });
      if (!result.data?.unlinkCurrentUserAccount) {
        throw new Error(t("user:security.accounts.unlink_failed"));
      }
      await refetchAccounts();
      toast.add({
        type: "success",
        title: t("user:security.accounts.unlinked"),
      });
    } catch (cause) {
      toast.add({
        type: "error",
        title:
          cause instanceof Error
            ? cause.message
            : t("user:security.accounts.unlink_failed"),
      });
    } finally {
      setUnlinkingAccountId(undefined);
    }
  };

  const handleLinkAccount = async (providerId: string) => {
    setLinkingProviderId(providerId);
    try {
      const callbackURL = new URL("/user/security", window.location.origin);
      const result = await linkAccount({
        variables: {
          input: {
            provider: providerId,
            callbackURL: callbackURL.toString(),
            errorCallbackURL: callbackURL.toString(),
          },
        },
      });
      const url = result.data?.linkCurrentUserAccount.url;
      if (!url) throw new Error(t("user:security.accounts.link_failed"));
      window.location.assign(url);
    } catch (cause) {
      toast.add({
        type: "error",
        title:
          cause instanceof Error
            ? cause.message
            : t("user:security.accounts.link_failed"),
      });
      setLinkingProviderId(undefined);
    }
  };

  const deleteForm = useForm({
    defaultValues: { password: "" },
    validators: {
      onSubmit: z.object({
        password: z.string().min(1, t("user:security.form.current_required")),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      const confirmed = await alertDialog({
        title: t("user:security.delete.confirm_title"),
        description: t("user:security.delete.confirm_description"),
        confirmText: t("user:security.delete.action"),
        cancelText: t("action.cancel"),
        variant: "destructive",
      });
      if (!confirmed) return;

      try {
        const result = await deleteUser({
          variables: { input: { password: value.password } },
        });
        if (!result.data?.deleteCurrentUser.success) {
          throw new Error(
            result.data?.deleteCurrentUser.message ||
              t("user:security.delete.failed"),
          );
        }
        await client.clearStore();
        await navigate({ to: "/auth/login", replace: true });
        toast.add({
          type: "success",
          title: t("user:security.delete.success"),
        });
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : t("user:security.delete.failed");
        formApi.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.add({ type: "error", title: message });
      }
    },
  });
  const deletingUser = useStore(
    deleteForm.store,
    (state) => state.isSubmitting,
  );
  const deletePassword = useStore(
    deleteForm.store,
    (state) => state.values.password,
  );
  const deleteError = useStore(deleteForm.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <Page
      variant="compact"
      title={t("user:security.title")}
      description={t("user:security.description")}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("user:security.card.title")}</CardTitle>
              <CardDescription>
                {t("user:security.card.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                id="user-password-form"
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
                    <passwordForm.Field name="currentPassword">
                      {(field) => (
                        <Input
                          id="current-password"
                          type="password"
                          autoComplete="current-password"
                          label={t("user:security.form.current_password")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </passwordForm.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <passwordForm.Field name="newPassword">
                      {(field) => (
                        <Input
                          id="new-password"
                          type="password"
                          autoComplete="new-password"
                          label={t("user:security.form.new_password")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </passwordForm.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <passwordForm.Field name="confirmPassword">
                      {(field) => (
                        <Input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          label={t("user:security.form.confirm_password")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </passwordForm.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <Field orientation="horizontal">
                      <passwordForm.Field name="revokeOtherSessions">
                        {(field) => (
                          <Checkbox
                            id="revoke-other-sessions"
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        )}
                      </passwordForm.Field>
                      <FieldLabel htmlFor="revoke-other-sessions">
                        {t("user:security.form.revoke_other_sessions")}
                      </FieldLabel>
                    </Field>
                  </FormLayoutItem>
                  {error && (
                    <FormLayoutItem>
                      <FieldError>{error}</FieldError>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <Button type="submit" form="user-password-form" loading={loading}>
                {t("user:security.form.submit")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>

        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("user:security.sessions.title")}</CardTitle>
              <CardDescription>
                {t("user:security.sessions.description")}
              </CardDescription>
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
                <ul className="divide-y">
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
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
                          loading={revokingSessionId === session.id}
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          {t("user:security.sessions.revoke")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                variant="outline"
                disabled={otherSessionCount === 0}
                loading={revokingOthers}
                onClick={handleRevokeOtherSessions}
              >
                {t("user:security.sessions.revoke_others")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>

        {sessionData?.currentUser.sessions.pageInfo.hasNextPage && (
          <PageLayoutSection>
            <Button
              variant="outline"
              loading={sessionsLoading}
              onClick={() =>
                fetchMoreSessions({
                  variables: {
                    after: sessionData.currentUser.sessions.pageInfo.endCursor,
                  },
                  updateQuery: (previous, { fetchMoreResult }) => ({
                    ...fetchMoreResult,
                    currentUser: {
                      ...fetchMoreResult.currentUser,
                      sessions: {
                        ...fetchMoreResult.currentUser.sessions,
                        edges: [
                          ...previous.currentUser.sessions.edges,
                          ...fetchMoreResult.currentUser.sessions.edges,
                        ],
                      },
                    },
                  }),
                })
              }
            >
              {t("action.load_more")}
            </Button>
          </PageLayoutSection>
        )}

        <PageLayoutSection>
          <Card>
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
                      >
                        <div>
                          <p className="font-medium capitalize">
                            {socialProviders.find(
                              (provider) => provider.id === account.providerId,
                            )?.name ?? account.providerId}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {account.issuer} · {account.accountId}
                          </p>
                        </div>
                        {!credential &&
                        (accountData?.currentUser.accounts.totalCount ?? 0) >
                          1 ? (
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
                    );
                  })}
                </div>
              )}
            </CardContent>
            {linkableProviders.length > 0 && (
              <CardFooter>
                <div className="flex flex-wrap gap-2">
                  {linkableProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      type="button"
                      variant="outline"
                      disabled={linkingProviderId !== undefined}
                      loading={linkingProviderId === provider.id}
                      onClick={() => handleLinkAccount(provider.id)}
                    >
                      {t("user:security.accounts.link", {
                        provider: provider.name,
                      })}
                    </Button>
                  ))}
                </div>
              </CardFooter>
            )}
          </Card>
        </PageLayoutSection>

        {accountData?.currentUser.accounts.pageInfo.hasNextPage && (
          <PageLayoutSection>
            <Button
              variant="outline"
              loading={accountsLoading}
              onClick={() =>
                fetchMoreAccounts({
                  variables: {
                    after: accountData.currentUser.accounts.pageInfo.endCursor,
                  },
                  updateQuery: (previous, { fetchMoreResult }) => ({
                    ...fetchMoreResult,
                    currentUser: {
                      ...fetchMoreResult.currentUser,
                      accounts: {
                        ...fetchMoreResult.currentUser.accounts,
                        edges: [
                          ...previous.currentUser.accounts.edges,
                          ...fetchMoreResult.currentUser.accounts.edges,
                        ],
                      },
                    },
                  }),
                })
              }
            >
              {t("action.load_more")}
            </Button>
          </PageLayoutSection>
        )}

        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("user:security.delete.title")}</CardTitle>
              <CardDescription>
                {t("user:security.delete.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                id="user-delete-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (deleteForm.state.isSubmitting) return;
                  deleteForm.setErrorMap({ onSubmit: undefined });
                  deleteForm.handleSubmit();
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <deleteForm.Field name="password">
                      {(field) => (
                        <Input
                          id="delete-account-password"
                          type="password"
                          autoComplete="current-password"
                          label={t("user:security.delete.password")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </deleteForm.Field>
                  </FormLayoutItem>
                  {deleteError && (
                    <FormLayoutItem>
                      <FieldError>{deleteError}</FieldError>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                form="user-delete-form"
                variant="destructive"
                disabled={!deletePassword}
                loading={deletingUser}
              >
                {t("user:security.delete.action")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
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
      revokeOtherSessions: z.boolean(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: t("auth:passwordReset.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
