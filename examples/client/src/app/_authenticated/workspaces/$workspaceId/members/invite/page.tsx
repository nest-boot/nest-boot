import { useId, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import z from "zod";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { getWorkspaceMembersResourceKey } from "@/lib/resource-keys";
import { workspaceMemberSearchSchema } from "@/schemas/workspace-member-search-schema";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { Link } from "@/components/link";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";
import { WorkspaceRole } from "@/gql/graphql";
import { isAccessDenied } from "@/lib/auth-errors";
import { getFormErrorMessage } from "@/lib/form-errors";

const GET_ROLES_FROM_INVITE_WORKSPACE_MEMBER_ROUTE = graphql(`
  query getRolesFromInviteWorkspaceMemberRoute {
    workspaceRoles {
      role
      grantable
    }
  }
`);

const CREATE_WORKSPACE_INVITATION_FROM_INVITE_WORKSPACE_MEMBER_ROUTE = graphql(`
  mutation createWorkspaceInvitationFromInviteWorkspaceMemberRoute(
    $input: CreateWorkspaceInvitationInput!
  ) {
    createWorkspaceInvitation(input: $input) {
      id
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/invite/",
)({
  component: InviteWorkspaceMemberPage,
  beforeLoad: async ({ context, params }) => {
    if (!context.ability.can("read", "WorkspaceMember")) {
      throw redirect({ to: "/workspaces/$workspaceId", params });
    }
    const denied = () =>
      redirect({ to: "/workspaces/$workspaceId/members", params });
    if (!context.ability.can("write", "WorkspaceInvitation")) throw denied();
    const { data } = await context.apolloClient
      .query({
        query: GET_ROLES_FROM_INVITE_WORKSPACE_MEMBER_ROUTE,
        context: { headers: { "x-workspace-id": params.workspaceId } },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    return {
      roleOptions: data?.workspaceRoles ?? [],
      title: t("workspace-member:invite.title"),
    };
  },
});

function InviteWorkspaceMemberPage() {
  const { workspaceId } = Route.useParams();
  return <InviteWorkspaceMemberForm key={workspaceId} />;
}

function InviteWorkspaceMemberForm() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { roleOptions } = Route.useRouteContext();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceMembersResourceKey(workspaceId)],
    searchSchema: workspaceMemberSearchSchema,
  });
  const ability = useAbility();
  const canInvite = ability.can("write", "WorkspaceInvitation");
  const formId = useId();
  const [inviteLink, setInviteLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const grantableOptions = roleOptions.filter(({ grantable }) => grantable);
  const [createWorkspaceInvitation] = useMutation(
    CREATE_WORKSPACE_INVITATION_FROM_INVITE_WORKSPACE_MEMBER_ROUTE,
  );

  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.add({
        type: "success",
        title: t("workspace-member:details.toast.link_copied"),
      });
    } catch {
      toast.add({
        type: "error",
        title: t("workspace-member:invite.copy_failed"),
      });
    }
  };

  const form = useForm({
    defaultValues: { email: "", roles: [] as Array<WorkspaceRole> },
    validators: {
      onSubmit: z.object({
        email: z
          .string()
          .trim()
          .min(1, t("workspace-member:invite.email_required"))
          .email(t("auth:form.email.invalid")),
        roles: z
          .array(z.enum(WorkspaceRole))
          .min(1, t("workspace-member:invite.role_required"))
          .refine(
            (roles) =>
              roles.every((role) =>
                grantableOptions.some((option) => option.role === role),
              ),
            t("workspace-member:invite.role_invalid"),
          ),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canInvite || inviteLink) return;
      try {
        const result = await createWorkspaceInvitation({
          variables: {
            input: { email: value.email.trim(), roles: value.roles },
          },
        });
        if (!result.data?.createWorkspaceInvitation.id)
          throw new Error(t("workspace-member:invite.failed"));
        const link = `${window.location.origin}/invite?invitationId=${result.data.createWorkspaceInvitation.id}`;
        setInviteLink(link);
        await copyInviteLink(link);
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              error instanceof Error
                ? error.message
                : t("workspace-member:invite.failed"),
            fields: {},
          },
        });
      }
    },
  });
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const error = useStore(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <Page
      variant="compact"
      title={t("workspace-member:invite.title")}
      description={t("workspace-member:invite.description")}
      breadcrumbActions={[
        {
          label: t("workspace-member:title"),
          render: (
            <Link
              to="/workspaces/$workspaceId/members"
              params={{ workspaceId }}
              search={backSearch}
            />
          ),
        },
      ]}
    >
      <PageLayout>
        <PageLayoutSection>
          {inviteLink ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("workspace-member:invite.link_generated")}
                </CardTitle>
                <CardDescription>
                  {t("workspace-member:invite.link_generated_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-md p-4">
                  <code className="text-sm break-all">{inviteLink}</code>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => copyInviteLink(inviteLink)}
                >
                  {copied ? (
                    <Check data-icon="inline-start" />
                  ) : (
                    <Copy data-icon="inline-start" />
                  )}
                  {t("workspace-member:invite.copy_link")}
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("workspace-member:invite.form_title")}</CardTitle>
                <CardDescription>
                  {t("workspace-member:invite.form_description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id={formId}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (form.state.isSubmitting || !canInvite) return;
                    form.setErrorMap({ onSubmit: undefined });
                    form.handleSubmit();
                  }}
                >
                  <FormLayout>
                    <FormLayoutItem>
                      <form.Field name="email">
                        {(field) => (
                          <Input
                            type="email"
                            label={t("workspace-member:invite.email_label")}
                            placeholder={t(
                              "workspace-member:invite.email_placeholder",
                            )}
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            disabled={submitting || !canInvite}
                            error={getFormErrorMessage(field.state.meta.errors)}
                          />
                        )}
                      </form.Field>
                    </FormLayoutItem>
                    <FormLayoutItem>
                      <form.Field name="roles">
                        {(field) => (
                          <>
                            <RoleCheckboxGroup
                              label={t("workspace-member:invite.role_label")}
                              options={grantableOptions}
                              value={field.state.value}
                              onValueChange={field.handleChange}
                              disabled={submitting || !canInvite}
                            />
                            <FieldError>
                              {getFormErrorMessage(field.state.meta.errors)}
                            </FieldError>
                          </>
                        )}
                      </form.Field>
                    </FormLayoutItem>
                    {grantableOptions.length === 0 && (
                      <FormLayoutItem>
                        <FieldError>
                          {t("workspace-member:invite.no_roles")}
                        </FieldError>
                      </FormLayoutItem>
                    )}
                    {error && (
                      <FormLayoutItem>
                        <FieldError>{error}</FieldError>
                      </FormLayoutItem>
                    )}
                  </FormLayout>
                </form>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  form={formId}
                  loading={submitting}
                  disabled={!canInvite || grantableOptions.length === 0}
                >
                  {t("workspace-member:invite.confirm_and_copy")}
                </Button>
              </CardFooter>
            </Card>
          )}
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
