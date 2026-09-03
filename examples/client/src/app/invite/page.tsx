import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import z from "zod";
import { t } from "i18next";

import { graphql } from "@/gql";
import { WorkspaceInvitationStatus } from "@/gql/graphql";
import { Button } from "@/components/thread-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const INVITATION_ID_KEY = "workspace_invitation_id";

const GET_CURRENT_USER_FROM_INVITE_ROUTE = graphql(`
  query getCurrentUserFromInviteRoute {
    currentUser {
      id
      name
      email
    }
  }
`);

const GET_WORKSPACE_INVITATION_FROM_INVITE_ROUTE = graphql(`
  query getWorkspaceInvitationFromInviteRoute($id: ID!) {
    workspaceInvitation(id: $id) {
      id
      email
      roles
      status
      expiresAt
      workspace {
        id
        name
      }
    }
  }
`);

const ACCEPT_WORKSPACE_INVITATION_FROM_INVITE_ROUTE = graphql(`
  mutation acceptWorkspaceInvitationFromInviteRoute($invitationId: ID!) {
    acceptWorkspaceInvitation(invitationId: $invitationId) {
      invitation {
        id
        status
        workspace {
          id
        }
      }
      member {
        id
        name
        roles
      }
    }
  }
`);

export const Route = createFileRoute("/invite/")({
  component: InviteComponent,
  validateSearch: zodValidator(
    z.object({
      invitationId: z.string().optional(),
    }),
  ),
});

function InviteComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const invitationId = search.invitationId || null;

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
  } = useQuery(GET_WORKSPACE_INVITATION_FROM_INVITE_ROUTE, {
    variables: { id: invitationId! },
    skip: !invitationId,
    errorPolicy: "all",
  });

  const [acceptInvitation, { loading: acceptLoading }] = useMutation(
    ACCEPT_WORKSPACE_INVITATION_FROM_INVITE_ROUTE,
  );
  const invitation = inviteData?.workspaceInvitation;
  const invitationUnavailableMessage = useMemo(() => {
    if (!invitationId) return t("workspace:invite.error.invalid_token");
    if (inviteError) return inviteError.message;
    if (!invitation) return null;
    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      return t(`workspace:invite.error.status.${invitation.status}`);
    }
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      return t("workspace:invite.error.expired");
    }
    return null;
  }, [invitation, invitationId, inviteError]);

  // 如果未登录，立即跳转到登录页（避免闪烁）
  useEffect(() => {
    // 只有在查询完成且确实没有用户数据时才跳转
    // 如果查询还在进行中，或者有错误但可能是网络问题，不跳转
    if (!meLoading && meData !== undefined && !meData?.currentUser) {
      if (invitationId && typeof window !== "undefined") {
        localStorage.setItem(INVITATION_ID_KEY, invitationId);
      }
      if (typeof window !== "undefined") {
        window.location.href = `${window.location.origin}/auth/login`;
      }
    }
  }, [meLoading, meData, invitationId]);

  useEffect(() => {
    if (
      !meLoading &&
      meData?.currentUser &&
      !inviteLoading &&
      invitationUnavailableMessage
    ) {
      localStorage.removeItem(INVITATION_ID_KEY);
    }
  }, [invitationUnavailableMessage, inviteLoading, meData, meLoading]);

  // 检查邮箱是否匹配
  const emailMismatch = useMemo(() => {
    const userEmail = meData?.currentUser?.email || "";
    const inviteEmail = inviteData?.workspaceInvitation?.email || null;
    return inviteEmail && inviteEmail.toLowerCase() !== userEmail.toLowerCase();
  }, [meData, inviteData]);

  const handleAccept = async () => {
    if (!invitationId) {
      toast.error(t("workspace:invite.error.invalid_token"));
      return;
    }

    try {
      const result = await acceptInvitation({
        variables: { invitationId },
      });
      const workspaceId =
        result.data?.acceptWorkspaceInvitation?.invitation.workspace.id;
      if (workspaceId) {
        localStorage.removeItem(INVITATION_ID_KEY);
        toast.success(t("workspace:invite.success"));
        navigate({
          to: "/workspaces/$workspaceId",
          params: { workspaceId },
        });
      } else {
        throw new Error(t("workspace:invite.error.accept_failed"));
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
  };

  const handleExit = () => {
    localStorage.removeItem(INVITATION_ID_KEY);
    navigate({ to: "/workspaces" });
  };

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
  if (!inviteLoading && invitationUnavailableMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("workspace:invite.error.title")}</CardTitle>
            <CardDescription>{invitationUnavailableMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExit} className="w-full">
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
    !inviteData?.workspaceInvitation
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
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {inviteData.workspaceInvitation.workspace.name} ·{" "}
              {inviteData.workspaceInvitation.email}
            </p>
            {emailMismatch ? (
              <p className="text-destructive text-sm">
                {t("workspace:invite.form.email.mismatch_error")}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleExit}
                className="flex-1"
              >
                {t("action.cancel")}
              </Button>
              <Button
                type="button"
                data-testid="invite-accept-submit"
                disabled={!!emailMismatch}
                loading={acceptLoading}
                className="flex-1"
                onClick={handleAccept}
              >
                {t("workspace:invite.form.submit")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
