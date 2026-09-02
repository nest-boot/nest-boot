import { useCallback, useMemo } from "react";
import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useForm, useStore } from "@tanstack/react-form";
import * as z from "zod";
import { toast } from "sonner";
import { t } from "i18next";

import { useCurrentWorkspaceMemberContext } from "../../contexts/current-workspace-member-context";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import {
  Page,
  PageActions,
  PageContent,
  PageHeader,
  PageSecondaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
import { Button } from "@/components/thread-ui/button";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/thread-ui/input";
import { RadioGroup } from "@/components/thread-ui/radio-group";
import { graphql } from "@/gql";
import * as Gql from "@/gql/graphql";
import { getRoleLabel } from "@/utils/get-role-label";
import {
  workspacePermissionOptions,
  workspacePermissionValues,
} from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";

const { WorkspaceMemberRole } = Gql;
type UpdateWorkspaceMemberInput = Gql.UpdateWorkspaceMemberInput;
type WorkspacePermission = Gql.WorkspacePermission;

const GET_CURRENT_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getCurrentWorkspaceMemberFromMemberRoute {
    currentWorkspaceMember {
      id
      role
    }
  }
`);

const GET_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getWorkspaceMemberFromMemberRoute($id: ID!) {
    workspaceMember(id: $id) {
      id
      name
      email
      role
      permissions
      status
      user {
        email
      }
    }
  }
`);

const UPDATE_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation updateWorkspaceMemberFromMemberRoute(
    $id: ID!
    $input: UpdateWorkspaceMemberInput!
  ) {
    updateWorkspaceMember(id: $id, input: $input) {
      id
      name
      email
      role
      permissions
      status
      user {
        email
      }
    }
  }
`);

const REMOVE_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation removeWorkspaceMemberFromMemberRoute($id: ID!) {
    removeWorkspaceMember(id: $id) {
      id
    }
  }
`);

const allPermissions = [...workspacePermissionValues];

const formSchema = z.object({
  name: z
    .string()
    .min(1, t("workspace-member:details.form.name.required"))
    .max(255, t("workspace-member:details.form.name.too_long")),
  email: z
    .string()
    .email(t("workspace-member:details.form.email.invalid"))
    .or(z.literal("")),
  role: z.nativeEnum(WorkspaceMemberRole),
  permissions: z.array(z.enum(workspacePermissionValues)),
});

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/$memberId/",
)({
  component: MemberComponent,
  beforeLoad: async ({
    context: { apolloClient },
    params: { memberId, workspaceId },
  }) => {
    const { data } = await apolloClient.query({
      query: GET_CURRENT_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE,
    });

    // 普通用户不能访问此页面
    if (
      !data?.currentWorkspaceMember ||
      data.currentWorkspaceMember.role === WorkspaceMemberRole.MEMBER
    ) {
      throw redirect({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE,
        variables: { id: memberId },
      });
      return {
        member: data?.workspaceMember,
        title:
          data?.workspaceMember?.name || t("workspace-member:details.title"),
      };
    } catch {}

    throw redirect({
      to: "/workspaces/$workspaceId/members",
      params: { workspaceId },
    });
  },
});

function MemberComponent() {
  const router = useRouter();
  const navigate = useNavigate();
  const { memberId, workspaceId } = Route.useParams();

  const currentWorkspaceMember = useCurrentWorkspaceMemberContext();

  const { data } = useSuspenseQuery(GET_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE, {
    variables: { id: memberId },
  });

  const member = data?.workspaceMember;

  if (!member) {
    return navigate({
      to: "/workspaces/$workspaceId/members",
      params: { workspaceId },
    });
  }

  // 判断是否可以修改角色
  const canEditRole = useMemo(() => {
    if (!currentWorkspaceMember || !member) return false;

    return !(
      (currentWorkspaceMember.role === WorkspaceMemberRole.OWNER &&
        memberId === currentWorkspaceMember.id) ||
      (memberId !== currentWorkspaceMember.id &&
        member.role === WorkspaceMemberRole.OWNER)
    );
  }, [
    currentWorkspaceMember.role,
    currentWorkspaceMember.id,
    memberId,
    member.role,
  ]);

  const form = useForm({
    defaultValues: {
      name: member.name,
      email: member.email ?? member.user?.email ?? "",
      role: member.role,
      permissions: [
        WorkspaceMemberRole.OWNER,
        WorkspaceMemberRole.ADMIN,
      ].includes(member.role)
        ? allPermissions
        : member.permissions,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const input: UpdateWorkspaceMemberInput = {};

        // 只传递有变化的字段
        if (value.name !== member?.name) {
          input.name = value.name;
        }

        const currentEmail = member.email ?? member.user?.email ?? "";

        if (value.email !== currentEmail) {
          input.email = value.email;
        }

        if (value.role !== member.role) {
          input.role = value.role;
        }

        // 比较权限数组是否变化
        const currentPermissions = member.permissions;
        const hasPermissionChanged =
          value.permissions.length !== currentPermissions.length ||
          value.permissions.some(
            (permission: WorkspacePermission) =>
              !currentPermissions.includes(permission),
          ) ||
          currentPermissions.some(
            (permission: WorkspacePermission) =>
              !value.permissions.includes(permission),
          );

        if (
          ![WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN].includes(
            value.role,
          ) &&
          hasPermissionChanged
        ) {
          input.permissions = value.permissions;
        }

        await updateWorkspaceMember({
          variables: {
            id: memberId,
            input,
          },
        });

        router.invalidate();

        form.reset(value);

        toast.success(t("workspace-member:details.toast.updated_success"));
      } catch (error) {
        toast.error(t("workspace-member:details.toast.update_failed"), {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });

  const isOwnerOrAdmin = useStore(form.store, (state) => {
    return [WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN].includes(
      state.values.role,
    );
  });

  const [updateWorkspaceMember, { loading: updateLoading }] = useMutation(
    UPDATE_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE,
  );
  const [removeWorkspaceMember] = useMutation(
    REMOVE_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE,
  );

  const handleRemoveWorkspaceMember = useCallback(async () => {
    try {
      await removeWorkspaceMember({
        variables: { id: memberId },
        update(cache, result) {
          if (result.data?.removeWorkspaceMember) {
            cache.evict({
              id: cache.identify(result.data.removeWorkspaceMember),
            });
            cache.gc();
          }
        },
      });

      toast.success(t("workspace-member:details.toast.deleted_success"));

      navigate({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    } catch (error) {
      toast.error(t("workspace-member:details.toast.delete_failed"), {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [removeWorkspaceMember, memberId, navigate, workspaceId]);

  const canRemove =
    memberId !== currentWorkspaceMember.id &&
    currentWorkspaceMember.role === WorkspaceMemberRole.OWNER;

  const handleRemoveClick = async () => {
    const confirmed = await alertDialog({
      title: t("workspace-member:delete.title"),
      description: t("workspace-member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });

    if (confirmed) {
      handleRemoveWorkspaceMember();
    }
  };

  return (
    <Page variant="compact">
      <PageHeader>
        <PageTitle>{member.name}</PageTitle>
        {canRemove ? (
          <PageActions>
            {canRemove ? (
              <PageSecondaryAction
                data-testid="workspace-member-delete-action"
                destructive
                onAction={handleRemoveClick}
              >
                {t("workspace-member:details.actions.delete_member")}
              </PageSecondaryAction>
            ) : null}
          </PageActions>
        ) : null}
      </PageHeader>
      <PageContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldSet>
            <FieldGroup>
              <form.Field
                name="name"
                validators={{
                  onChange: z
                    .string()
                    .min(1, t("workspace-member:details.form.name.required"))
                    .max(255, t("workspace-member:details.form.name.too_long")),
                }}
              >
                {(field) => (
                  <Input
                    id={field.name}
                    name={field.name}
                    label={t("workspace-member:details.form.name.label")}
                    description={t(
                      "workspace-member:details.form.name.description",
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={
                      field.state.meta.isTouched && !field.state.meta.isValid
                        ? field.state.meta.errors
                            .map((error: any) =>
                              typeof error === "string"
                                ? error
                                : error?.message || error,
                            )
                            .join(", ")
                        : undefined
                    }
                    aria-required="true"
                    required
                    autoComplete="off"
                  />
                )}
              </form.Field>

              <form.Field
                name="email"
                validators={{
                  onChange: z
                    .string()
                    .email(t("workspace-member:details.form.email.invalid"))
                    .or(z.literal("")),
                }}
              >
                {(field) => (
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    label={t("workspace-member:details.form.email.label")}
                    placeholder={t(
                      "workspace-member:details.form.email.placeholder",
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={
                      field.state.meta.isTouched && !field.state.meta.isValid
                        ? field.state.meta.errors
                            .map((error: any) =>
                              typeof error === "string"
                                ? error
                                : error?.message || error,
                            )
                            .join(", ")
                        : undefined
                    }
                    autoComplete="email"
                    className="w-full"
                  />
                )}
              </form.Field>

              <form.Field name="role">
                {(field) => (
                  <RadioGroup
                    label={t("workspace-member:details.form.role.label")}
                    items={Object.values(WorkspaceMemberRole)
                      .filter(
                        (role) =>
                          role !== WorkspaceMemberRole.OWNER ||
                          field.state.value === WorkspaceMemberRole.OWNER,
                      )
                      .map((role) => ({
                        label: getRoleLabel(role),
                        value: role,
                        disabled:
                          role === WorkspaceMemberRole.OWNER || !canEditRole,
                      }))}
                    value={field.state.value}
                    onValueChange={(value: Gql.WorkspaceMemberRole) => {
                      field.handleChange(value);

                      if (value === WorkspaceMemberRole.MEMBER) {
                        form.setFieldValue(
                          "permissions",
                          member?.permissions ?? [],
                        );
                      } else {
                        form.setFieldValue("permissions", allPermissions);
                      }
                    }}
                    disabled={!canEditRole}
                  />
                )}
              </form.Field>

              <form.Field name="permissions">
                {(field) => (
                  <PermissionCheckboxGroup
                    options={workspacePermissionOptions}
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={updateLoading || isOwnerOrAdmin}
                  />
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => [
                  state.isDirty,
                  state.isSubmitting,
                  state.canSubmit,
                ]}
              >
                {([isDirty, isSubmitting, canSubmit]) => (
                  <Field orientation="horizontal">
                    <Button
                      type="submit"
                      disabled={!isDirty || !canSubmit}
                      loading={isSubmitting}
                    >
                      {t("action.save")}
                    </Button>
                  </Field>
                )}
              </form.Subscribe>
            </FieldGroup>
          </FieldSet>
        </form>
      </PageContent>
    </Page>
  );
}
