import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import z from "zod";
import { t } from "i18next";

import { graphql } from "@/gql";
import { Button } from "@/components/thread-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/thread-ui/input";

const INVITE_TOKEN_KEY = "workspace_invite_token";

const GET_CURRENT_USER_FROM_INVITE_ROUTE = graphql(`
  query getCurrentUserFromInviteRoute {
    currentUser {
      id
      name
      email
    }
  }
`);

const GET_WORKSPACE_MEMBER_BY_TOKEN_FROM_INVITE_ROUTE = graphql(`
  query getWorkspaceMemberByTokenFromInviteRoute($token: String!) {
    workspaceMemberByToken(token: $token) {
      id
      name
      email
      role
      status
      inviteExpiresAt
    }
  }
`);

const ACCEPT_WORKSPACE_INVITE_FROM_INVITE_ROUTE = graphql(`
  mutation acceptWorkspaceInviteFromInviteRoute(
    $token: String!
    $input: AcceptWorkspaceInviteInput
  ) {
    acceptWorkspaceInvite(token: $token, input: $input) {
      workspaceMember {
        id
        name
        role
      }
      workspaceId
    }
  }
`);

export const Route = createFileRoute("/invite/")({
  component: InviteComponent,
  validateSearch: zodValidator(
    z.object({
      token: z.string().optional(),
    }),
  ),
});

function InviteComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const token = search.token || null;

  // 查询当前用户信息
  const { data: meData, loading: meLoading } = useQuery(
    GET_CURRENT_USER_FROM_INVITE_ROUTE,
    {
      errorPolicy: "all",
      fetchPolicy: "cache-and-network",
    },
  );

  // 查询邀请信息（所有 hooks 必须在条件判断之前调用）
  const {
    data: inviteData,
    loading: inviteLoading,
    error: inviteError,
  } = useQuery(GET_WORKSPACE_MEMBER_BY_TOKEN_FROM_INVITE_ROUTE, {
    variables: { token: token! },
    skip: !token,
    errorPolicy: "all",
  });

  const [acceptInvite, { loading: acceptLoading }] = useMutation(
    ACCEPT_WORKSPACE_INVITE_FROM_INVITE_ROUTE,
  );

  // 如果未登录，立即跳转到登录页（避免闪烁）
  useEffect(() => {
    // 只有在查询完成且确实没有用户数据时才跳转
    // 如果查询还在进行中，或者有错误但可能是网络问题，不跳转
    if (!meLoading && meData !== undefined && !meData?.currentUser) {
      if (token && typeof window !== "undefined") {
        localStorage.setItem(INVITE_TOKEN_KEY, token);
      }
      if (typeof window !== "undefined") {
        window.location.href = `${window.location.origin}/auth/login`;
      }
    }
  }, [meLoading, meData, token]);

  // 检查邮箱是否匹配
  const emailMismatch = useMemo(() => {
    const userEmail = meData?.currentUser?.email || "";
    const inviteEmail = inviteData?.workspaceMemberByToken?.email || null;
    // 如果邀请者指定了 email，且与用户 email 不一致，则显示错误
    return inviteEmail && inviteEmail !== userEmail;
  }, [meData, inviteData]);

  const form = useForm({
    defaultValues: {
      name: meData?.currentUser?.name || "",
      email: meData?.currentUser?.email || "",
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        toast.error(t("workspace:invite.error.invalid_token"));
        return;
      }

      try {
        const result = await acceptInvite({
          variables: {
            token,
            input: {
              name: value.name?.trim() || undefined,
            },
          },
        });

        if (result.data?.acceptWorkspaceInvite) {
          localStorage.removeItem(INVITE_TOKEN_KEY);
          toast.success(t("workspace:invite.success"));

          const workspaceId = result.data.acceptWorkspaceInvite.workspaceId;
          navigate({
            to: "/workspaces/$workspaceId",
            params: { workspaceId },
          });
        }
      } catch (error) {
        const errorMessage =
          (error instanceof Error && error.message) ||
          (error && typeof error === "object" && "graphQLErrors" in error
            ? (error as { graphQLErrors?: Array<{ message?: string }> })
                .graphQLErrors?.[0]?.message
            : undefined) ||
          t("workspace:invite.error.accept_failed");
        toast.error(errorMessage);
      }
    },
  });

  // 当数据加载完成后更新表单值
  useEffect(() => {
    if (meData?.currentUser) {
      form.reset({
        name: meData.currentUser.name || "",
        email: meData.currentUser.email || "",
      });
    }
  }, [meData, form]);

  // 如果未登录，不渲染后续内容（避免闪烁）
  // 只有在查询完成且确实没有用户数据时才显示加载状态
  if (!meLoading && meData !== undefined && !meData?.currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-4 text-sm">
            {t("workspace:invite.loading")}
          </p>
        </div>
      </div>
    );
  }

  // 错误处理（只有在查询完成且确实有错误或没有数据时才显示）
  if (!inviteLoading && inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("workspace:invite.error.title")}</CardTitle>
            <CardDescription>
              {inviteError?.message ||
                t("workspace:invite.error.invalid_token")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: "/workspaces" })}
              className="w-full"
            >
              {t("workspace:invite.error.back_button")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 加载中或数据未准备好时，不渲染表单（避免空表单闪烁）
  if (
    meLoading ||
    inviteLoading ||
    !meData?.currentUser ||
    !inviteData?.workspaceMemberByToken
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-4 text-sm">
            {t("workspace:invite.loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      data-testid="invite-accept-page"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("workspace:invite.title")}</CardTitle>
          <CardDescription>{t("workspace:invite.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <Input
                  id="name"
                  data-testid="invite-accept-name-input"
                  label={t("workspace:invite.form.name.label")}
                  description={t("workspace:invite.form.name.description")}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <Input
                  id="email"
                  data-testid="invite-accept-email-input"
                  type="email"
                  label={t("workspace:invite.form.email.label")}
                  disabled={true}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={
                    emailMismatch
                      ? t("workspace:invite.form.email.mismatch_error")
                      : undefined
                  }
                />
              )}
            </form.Field>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/workspaces" })}
                className="flex-1"
              >
                {t("action.cancel")}
              </Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    data-testid="invite-accept-submit"
                    disabled={!!emailMismatch}
                    loading={isSubmitting || acceptLoading}
                    className="flex-1"
                  >
                    {t("workspace:invite.form.submit")}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
