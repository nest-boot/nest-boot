import { useCallback } from "react";
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

import {
  useCurrentMemberContext,
  useCurrentWorkspaceAbility,
} from "../../contexts/current-member-context";
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
import { WorkspaceRole } from "@/gql/graphql";
import { getRoleLabel } from "@/utils/get-role-label";
import {
  isWorkspacePermission,
  workspacePermissionOptions,
  workspacePermissionValues,
} from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { createAbilitySubject } from "@/lib/ability";

const GET_CURRENT_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getCurrentMemberFromMemberRoute {
    currentMember {
      id
      roles
      permissions
    }
  }
`);

const GET_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getMemberFromMemberRoute($id: ID!) {
    member(id: $id) {
      id
      roles
      permissions
      status
      name
      email
    }
    workspaceRoles
    workspaceAssignableRoles
    workspacePermissions
  }
`);

const UPDATE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {
    updateMember(id: $id, input: $input) {
      id
      name
      email
    }
  }
`);

const SET_WORKSPACE_MEMBER_ROLES_FROM_MEMBER_ROUTE = graphql(`
  mutation setMemberRolesFromMemberRoute(
    $id: ID!
    $input: SetMemberRolesInput!
  ) {
    setMemberRoles(id: $id, input: $input) {
      id
      roles
    }
  }
`);

const SET_MEMBER_PERMISSIONS_FROM_MEMBER_ROUTE = graphql(`
  mutation setMemberPermissionsFromMemberRoute(
    $id: ID!
    $input: SetMemberPermissionsInput!
  ) {
    setMemberPermissions(id: $id, input: $input) {
      id
      permissions
    }
  }
`);

const REMOVE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation removeMemberFromMemberRoute($id: ID!) {
    removeMember(id: $id) {
      id
    }
  }
`);

const formSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().email().or(z.literal("")),
  roles: z.array(z.enum(WorkspaceRole)).min(1),
  permissions: z.array(z.enum(workspacePermissionValues)),
});

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/$memberId/",
)({
  component: MemberComponent,
  beforeLoad: async ({
    context: { apolloClient, currentWorkspaceAbility },
    params: { memberId, workspaceId },
  }) => {
    const { data } = await apolloClient.query({
      query: GET_CURRENT_MEMBER_FROM_MEMBER_ROUTE,
    });

    if (
      !data?.currentMember ||
      !currentWorkspaceAbility.can("update", "Member")
    ) {
      throw redirect({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_MEMBER_FROM_MEMBER_ROUTE,
        variables: { id: memberId },
      });
      if (
        !data?.member ||
        !currentWorkspaceAbility.can(
          "update",
          createAbilitySubject("Member", data.member),
        )
      ) {
        throw redirect({
          to: "/workspaces/$workspaceId/members",
          params: { workspaceId },
        });
      }
      return {
        member: data?.member,
        title: data?.member?.name || t("member:details.title"),
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

  const currentMember = useCurrentMemberContext();
  const currentWorkspaceAbility = useCurrentWorkspaceAbility();

  const { data } = useSuspenseQuery(GET_MEMBER_FROM_MEMBER_ROUTE, {
    variables: { id: memberId },
  });

  const member = data?.member;

  if (!member) {
    return navigate({
      to: "/workspaces/$workspaceId/members",
      params: { workspaceId },
    });
  }

  const canManageRoles = currentWorkspaceAbility.can(
    "update",
    createAbilitySubject("Member", member),
  );

  const canManagePermissions = currentWorkspaceAbility.can(
    "update",
    createAbilitySubject("Member", member),
  );
  const canManageProfile = currentWorkspaceAbility.can(
    "update",
    createAbilitySubject("Member", member),
  );
  const [updateMember] = useMutation(UPDATE_MEMBER_FROM_MEMBER_ROUTE);

  const form = useForm({
    defaultValues: {
      name: member.name,
      email: member.email ?? "",
      roles: member.roles,
      permissions: member.permissions.filter(isWorkspacePermission),
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const hasRolesChanged =
          value.roles.length !== member.roles.length ||
          value.roles.some((role) => !member.roles.includes(role));

        if (
          hasRolesChanged &&
          value.roles.some(
            (role) => !data.workspaceAssignableRoles.includes(role),
          )
        ) {
          throw new Error("Selected roles exceed your grant permissions");
        }

        // Compare the complete direct-permission list before submitting.
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

        if (
          canManageProfile &&
          (value.name !== member.name || value.email !== (member.email ?? ""))
        ) {
          operations.push(
            updateMember({
              variables: {
                id: memberId,
                input: { name: value.name, email: value.email || null },
              },
            }),
          );
        }
        if (canManageRoles && hasRolesChanged) {
          operations.push(
            setMemberRoles({
              variables: {
                id: memberId,
                input: { roles: value.roles },
              },
            }),
          );
        }
        if (canManagePermissions && hasPermissionChanged) {
          operations.push(
            setMemberPermissions({
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

        toast.success(t("member:details.toast.updated_success"));
      } catch (error) {
        toast.error(t("member:details.toast.update_failed"), {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });

  const [setMemberRoles, { loading: updatingRole }] = useMutation(
    SET_WORKSPACE_MEMBER_ROLES_FROM_MEMBER_ROUTE,
  );
  const [setMemberPermissions, { loading: updatingPermissions }] = useMutation(
    SET_MEMBER_PERMISSIONS_FROM_MEMBER_ROUTE,
  );
  const [removeMember] = useMutation(REMOVE_MEMBER_FROM_MEMBER_ROUTE);

  const handleRemoveMember = useCallback(async () => {
    try {
      await removeMember({
        variables: { id: memberId },
        update(cache, result) {
          if (result.data?.removeMember) {
            cache.evict({
              id: cache.identify({
                __typename: "Member",
                id: result.data.removeMember.id,
              }),
            });
            cache.gc();
          }
        },
      });

      toast.success(t("member:details.toast.deleted_success"));

      navigate({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    } catch (error) {
      toast.error(t("member:details.toast.delete_failed"), {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [removeMember, memberId, navigate, workspaceId]);

  const canRemove =
    memberId !== currentMember.id &&
    currentWorkspaceAbility.can(
      "delete",
      createAbilitySubject("Member", member),
    );

  const handleRemoveClick = async () => {
    const confirmed = await alertDialog({
      title: t("member:delete.title"),
      description: t("member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });

    if (confirmed) {
      handleRemoveMember();
    }
  };

  return (
    <Page variant="compact" data-testid="member-detail-page">
      <PageHeader>
        <PageTitle>{member.name ?? member.id}</PageTitle>
        {canRemove ? (
          <PageActions>
            {canRemove ? (
              <PageSecondaryAction
                data-testid="member-delete-action"
                destructive
                onAction={handleRemoveClick}
              >
                {t("member:details.actions.delete_member")}
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
              <form.Field name="name">
                {(field) => (
                  <Input
                    id="member-name"
                    label={t("member:details.form.name.label")}
                    description={t("member:details.form.name.description")}
                    disabled={!canManageProfile}
                    error={field.state.meta.errors
                      .map((error) => error?.message)
                      .filter(Boolean)
                      .join(", ")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <Input
                    id="member-email"
                    label={t("member:details.form.email.label")}
                    description={t("member:details.form.email.description")}
                    disabled={!canManageProfile}
                    error={field.state.meta.errors
                      .map((error) => error?.message)
                      .filter(Boolean)
                      .join(", ")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
              <form.Field name="roles">
                {(field) => (
                  <CheckboxGroup
                    label={t("member:details.form.role.label")}
                    items={[
                      ...new Set([...data.workspaceRoles, ...member.roles]),
                    ].map((role) => ({
                      label: getRoleLabel(role),
                      value: role,
                      testId: `member-role-${role}`,
                      // Existing roles stay visible and may be removed, but cannot be re-granted.
                      disabled:
                        !canManageRoles ||
                        (!data.workspaceAssignableRoles.includes(role) &&
                          !field.state.value.includes(role)),
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
                    disabled={updatingPermissions || !canManagePermissions}
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
                      data-testid="member-save"
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
