import { useCallback, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Copy } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { t } from "i18next";
import { Button } from "@/components/thread-ui/button";
import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";
import { Input } from "@/components/thread-ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRoleLabel } from "@/utils/get-role-label";
import { graphql } from "@/gql";
import {
  WORKSPACE_MEMBER_ROLE,
  workspaceAssignableRoles,
} from "@/lib/workspace-roles";

const CREATE_WORKSPACE_INVITATION_FROM_INVITE_MEMBER_DIALOG = graphql(`
  mutation createWorkspaceInvitationFromInviteMemberDialog(
    $input: CreateWorkspaceInvitationInput!
  ) {
    createWorkspaceInvitation(input: $input) {
      id
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
  onSuccess?: () => void | Promise<void>;
}) {
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [createWorkspaceInvitation, { loading: createInviteLoading }] =
    useMutation(CREATE_WORKSPACE_INVITATION_FROM_INVITE_MEMBER_DIALOG);

  const inviteForm = useForm({
    defaultValues: {
      roles: [WORKSPACE_MEMBER_ROLE],
      email: "",
    },
    onSubmit: async ({ value }) => {
      const email = value.email.trim();
      if (!email) {
        toast.error(t("workspace-member:invite.email_required"));
        return;
      }
      if (value.roles.length === 0) {
        toast.error(t("workspace-member:invite.role_label"));
        return;
      }

      try {
        const result = await createWorkspaceInvitation({
          variables: {
            input: {
              email,
              roles: value.roles,
            },
          },
        });

        if (result.data?.createWorkspaceInvitation?.id) {
          const invitationId = result.data.createWorkspaceInvitation.id;
          const link = `${window.location.origin}/invite?invitationId=${invitationId}`;
          setInviteLink(link);
          onInviteOpenChange(false);
          setInviteLinkOpen(true);
          inviteForm.reset();
          await onSuccess?.();

          try {
            await navigator.clipboard.writeText(link);
            toast.success(t("workspace-member:invite.link_copied"));
          } catch {
            toast.error(t("workspace-member:invite.copy_failed"));
          }
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

              <inviteForm.Field name="roles">
                {(field) => (
                  <CheckboxGroup
                    label={t("workspace-member:invite.role_label")}
                    items={workspaceAssignableRoles.map((role) => ({
                      label: getRoleLabel(role),
                      value: role,
                    }))}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
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
