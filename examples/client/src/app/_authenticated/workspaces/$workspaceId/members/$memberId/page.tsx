import { useCallback, useMemo } from "react";
import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import * as z from "zod";
import { toast } from "sonner";
import { t } from "i18next";

import { useCurrentWorkspaceMemberContext } from "../../contexts/current-workspace-member-context";
import type * as Gql from "@/gql/graphql";
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
import { CheckboxGroup } from "@/components/thread-ui/checkbox-group";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/thread-ui/input";
import { graphql } from "@/gql";
import { getRoleLabel } from "@/utils/get-role-label";
import {
  isWorkspacePermission,
  workspaceMemberCan,
  workspacePermissionOptions,
  workspacePermissionValues,
} from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { WORKSPACE_OWNER_ROLE, hasWorkspaceRole } from "@/lib/workspace-roles";

type UpdateWorkspaceMemberInput = Gql.UpdateWorkspaceMemberInput;

const GET_CURRENT_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getCurrentWorkspaceMemberFromMemberRoute {
    currentWorkspaceMember {
      id
      roles
      permissions
    }
  }
`);

const GET_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getWorkspaceMemberFromMemberRoute($id: ID!) {
    workspaceMember(id: $id) {
      id
      name
      email
      roles
      permissions
      status
      user {
        email
      }
    }
    workspaceRoles {
      name
      permissions
    }
    workspacePermissions
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
      roles
      permissions
      status
      user {
        email
      }
    }
  }
`);

const UPDATE_WORKSPACE_MEMBER_ROLE_FROM_MEMBER_ROUTE = graphql(`
  mutation updateWorkspaceMemberRoleFromMemberRoute(
    $id: ID!
    $input: UpdateWorkspaceMemberRoleInput!
  ) {
    updateWorkspaceMemberRole(id: $id, input: $input) {
      id
      roles
    }
  }
`);

const SET_WORKSPACE_MEMBER_PERMISSIONS_FROM_MEMBER_ROUTE = graphql(`
  mutation setWorkspaceMemberPermissionsFromMemberRoute(
    $id: ID!
    $input: SetWorkspaceMemberPermissionsInput!
  ) {
    setWorkspaceMemberPermissions(id: $id, input: $input) {
      id
      permissions
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

const formSchema = z.object({
  name: z
    .string()
    .min(1, t("workspace-member:details.form.name.required"))
    .max(255, t("workspace-member:details.form.name.too_long")),
  email: z
    .string()
    .email(t("workspace-member:details.form.email.invalid"))
    .or(z.literal("")),
  roles: z.array(z.string()).min(1),
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

    if (
      !data?.currentWorkspaceMember ||
      !workspaceMemberCan(data.currentWorkspaceMember, "workspaceMember:update")
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

  const canManageRoles = useMemo(() => {
    if (!currentWorkspaceMember || !member) return false;

    return (
      workspaceMemberCan(currentWorkspaceMember, "workspaceMember:update") &&
      !hasWorkspaceRole(member.roles, WORKSPACE_OWNER_ROLE)
    );
  }, [
    currentWorkspaceMember.roles,
    currentWorkspaceMember.id,
    memberId,
    member.roles,
  ]);

  const canManagePermissions =
    hasWorkspaceRole(currentWorkspaceMember.roles, WORKSPACE_OWNER_ROLE) &&
    !hasWorkspaceRole(member.roles, WORKSPACE_OWNER_ROLE);

  const form = useForm({
    defaultValues: {
      name: member.name,
      email: member.email ?? member.user?.email ?? "",
      roles: member.roles,
      permissions: member.permissions.filter(isWorkspacePermission),
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

        const hasRolesChanged =
          value.roles.length !== member.roles.length ||
          value.roles.some((role) => !member.roles.includes(role));

        // 比较权限数组是否变化
        const currentPermissions = member.permissions.filter(
          isWorkspacePermission,
        );
        const hasPermissionChanged =
          value.permissions.length !== currentPermissions.length ||
          value.permissions.some(
            (permission) => !currentPermissions.includes(permission),
          ) ||
          currentPermissions.some(
            (permission) => !value.permissions.includes(permission),
          );

        const operations: Array<Promise<unknown>> = [];

        if (Object.keys(input).length > 0) {
          operations.push(
            updateWorkspaceMember({
              variables: {
                id: memberId,
                input,
              },
            }),
          );
        }
        if (canManageRoles && hasRolesChanged) {
          operations.push(
            updateWorkspaceMemberRole({
              variables: {
                id: memberId,
                input: { roles: value.roles },
              },
            }),
          );
        }
        if (canManagePermissions && hasPermissionChanged) {
          operations.push(
            setWorkspaceMemberPermissions({
              variables: {
                id: memberId,
                input: { permissions: value.permissions },
              },
            }),
          );
        }

        await Promise.all(operations);

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

  const [updateWorkspaceMember, { loading: updateLoading }] = useMutation(
    UPDATE_WORKSPACE_MEMBER_FROM_MEMBER_ROUTE,
  );
  const [updateWorkspaceMemberRole, { loading: updatingRole }] = useMutation(
    UPDATE_WORKSPACE_MEMBER_ROLE_FROM_MEMBER_ROUTE,
  );
  const [setWorkspaceMemberPermissions, { loading: updatingPermissions }] =
    useMutation(SET_WORKSPACE_MEMBER_PERMISSIONS_FROM_MEMBER_ROUTE);
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
    !hasWorkspaceRole(member.roles, WORKSPACE_OWNER_ROLE) &&
    workspaceMemberCan(currentWorkspaceMember, "workspaceMember:delete");

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

              <form.Field name="roles">
                {(field) => (
                  <CheckboxGroup
                    label={t("workspace-member:details.form.role.label")}
                    items={(hasWorkspaceRole(
                      field.state.value,
                      WORKSPACE_OWNER_ROLE,
                    )
                      ? data.workspaceRoles
                      : data.workspaceRoles.filter(
                          (role) => role.name !== WORKSPACE_OWNER_ROLE,
                        )
                    ).map((role) => ({
                      label: getRoleLabel(role.name),
                      value: role.name,
                      disabled:
                        role.name === WORKSPACE_OWNER_ROLE || !canManageRoles,
                    }))}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
                    disabled={!canManageRoles}
                  />
                )}
              </form.Field>

              <form.Field name="permissions">
                {(field) => (
                  <PermissionCheckboxGroup
                    options={workspacePermissionOptions}
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={
                      updateLoading ||
                      updatingPermissions ||
                      !canManagePermissions
                    }
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
                      loading={
                        isSubmitting || updatingRole || updatingPermissions
                      }
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
