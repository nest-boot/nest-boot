import { useCallback, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Copy } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { t } from "i18next";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { RadioGroup } from "@/components/thread-ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceMemberRole } from "@/gql/graphql";
import { getRoleLabel } from "@/utils/get-role-label";
import { graphql } from "@/gql";

const CREATE_WORKSPACE_INVITE_FROM_INVITE_MEMBER_DIALOG = graphql(`
  mutation createWorkspaceInviteFromInviteMemberDialog(
    $input: CreateWorkspaceInviteInput!
  ) {
    createWorkspaceInvite(input: $input) {
      id
      inviteToken
    }
  }
`);

export function InviteMemberDialog({
  inviteOpen,
  onInviteOpenChange,
  onSuccess,
}: {
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [createWorkspaceInvite, { loading: createInviteLoading }] = useMutation(
    CREATE_WORKSPACE_INVITE_FROM_INVITE_MEMBER_DIALOG,
  );

  const inviteForm = useForm({
    defaultValues: {
      role: WorkspaceMemberRole.MEMBER,
      email: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await createWorkspaceInvite({
          variables: {
            input: {
              email: value.email.trim() || undefined,
              role: value.role,
            },
          },
        });

        if (result.data?.createWorkspaceInvite?.inviteToken) {
          const token = result.data.createWorkspaceInvite.inviteToken;
          const link = `${window.location.origin}/invite?token=${token}`;
          setInviteLink(link);

          // 自动复制到剪切板
          await navigator.clipboard.writeText(link);
          toast.success(t("workspace-member:invite.link_copied"));

          // 关闭第一个对话框，打开第二个对话框
          onInviteOpenChange(false);
          setInviteLinkOpen(true);
          inviteForm.reset();

          // 调用成功回调
          onSuccess?.();
        }
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message);
        }
      }
    },
  });

  const handleInviteOpenChange = (open: boolean) => {
    if (!open) {
      inviteForm.reset();
    }
    onInviteOpenChange(open);
  };

  const handleCopyInviteLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("workspace-member:invite.link_copied"));
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  }, []);

  return (
    <>
      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent
          className="max-w-md"
          data-testid="workspace-invite-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("workspace-member:invite.title")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              inviteForm.handleSubmit();
            }}
          >
            <div className="space-y-4">
              <div className="bg-muted text-muted-foreground rounded-lg p-4 text-sm">
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("workspace-member:invite.description")}</li>
                  <li>{t("workspace-member:invite.link_copied")}</li>
                  <li>{t("workspace-member:invite.link_user_join")}</li>
                  <li>{t("workspace-member:invite.link_expires")}</li>
                </ul>
              </div>

              <inviteForm.Field name="email">
                {(field) => (
                  <Input
                    id="invite-email"
                    data-testid="workspace-invite-email-input"
                    type="email"
                    label={t("workspace-member:invite.email_label")}
                    placeholder={t("workspace-member:invite.email_placeholder")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={
                      field.state.meta.errors.length > 0
                        ? field.state.meta.errors
                            .map((error: any) =>
                              typeof error === "string"
                                ? error
                                : error?.message || error,
                            )
                            .join(", ")
                        : undefined
                    }
                  />
                )}
              </inviteForm.Field>

              <inviteForm.Field name="role">
                {(field) => (
                  <RadioGroup
                    label={t("workspace-member:invite.role_label")}
                    items={Object.values(WorkspaceMemberRole)
                      .filter((role) => role !== WorkspaceMemberRole.OWNER)
                      .map((role) => ({
                        label: getRoleLabel(role),
                        value: role,
                      }))}
                    value={field.state.value}
                    onValueChange={(value: WorkspaceMemberRole) =>
                      field.handleChange(value)
                    }
                  />
                )}
              </inviteForm.Field>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleInviteOpenChange(false)}
              >
                {t("action.cancel")}
              </Button>
              <Button
                type="submit"
                data-testid="workspace-invite-confirm"
                loading={createInviteLoading}
              >
                {t("workspace-member:invite.confirm_and_copy")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 邀请链接对话框 */}
      <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}>
        <DialogContent
          className="max-w-md"
          data-testid="workspace-invite-link-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {t("workspace-member:invite.link_generated")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("workspace-member:invite.link_generated_description")}
            </p>

            <div className="bg-muted flex items-center gap-2 rounded-lg border p-3">
              <p
                className="flex-1 font-mono text-sm break-all"
                data-testid="workspace-invite-link"
              >
                {inviteLink}
              </p>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopyInviteLink(inviteLink)}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              data-testid="workspace-invite-link-close"
              onClick={() => setInviteLinkOpen(false)}
            >
              {t("action.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
