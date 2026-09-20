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

import { useCurrentMemberContext } from "../../contexts/current-member-context";
import { useAbility } from "@/contexts/ability-context";
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
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/thread-ui/input";
import { graphql } from "@/gql";
import { WorkspacePermission, WorkspaceRole } from "@/gql/graphql";
import { getPermissionOptions } from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { createAbilitySubject } from "@/lib/ability";

const GET_CURRENT_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getCurrentMemberFromMemberRoute {
    currentMember {
      workspaceId
      id
      roles
      permissions
    }
  }
`);

const GET_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  query getMemberFromMemberRoute($id: ID!) {
    member(id: $id) {
      workspaceId
      id
      roles
      permissions
      status
      name
      email
    }
    workspaceRoles {
      role
      grantable
    }
    workspacePermissions {
      permission
      grantable
    }
  }
`);

const UPDATE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {
    updateMember(id: $id, input: $input) {
      id
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
  permissions: z.array(z.enum(WorkspacePermission)),
});

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/$memberId/",
)({
  component: MemberComponent,
  beforeLoad: async ({
    context: { apolloClient, ability },
    params: { memberId, workspaceId },
  }) => {
    const { data } = await apolloClient.query({
      query: GET_CURRENT_MEMBER_FROM_MEMBER_ROUTE,
    });

    if (!data?.currentMember || !ability.can("read", "Member")) {
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
        !ability.can("read", createAbilitySubject("Member", data.member))
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
  const ability = useAbility();

  const { data, refetch } = useSuspenseQuery(GET_MEMBER_FROM_MEMBER_ROUTE, {
    variables: { id: memberId },
  });

  const member = data?.member;

  if (!member) {
    return navigate({
      to: "/workspaces/$workspaceId/members",
      params: { workspaceId },
    });
  }

  const canManageRoles = ability.can(
    "set-roles",
    createAbilitySubject("Member", member),
  );

  const canManagePermissions = ability.can(
    "set-permissions",
    createAbilitySubject("Member", member),
  );
  const canManageProfile = ability.can(
    "write",
    createAbilitySubject("Member", member),
  );
  const [updateMember] = useMutation(UPDATE_MEMBER_FROM_MEMBER_ROUTE);

  const form = useForm({
    defaultValues: {
      name: member.name,
      email: member.email ?? "",
      roles: member.roles,
      permissions: member.permissions,
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
            (role) =>
              !data.workspaceRoles.some(
                (option) => option.role === role && option.grantable,
              ),
          )
        ) {
          throw new Error("Selected roles exceed your grant permissions");
        }

        // Compare the complete direct-permission list before submitting.
        const currentPermissions = member.permissions;
        const hasPermissionChanged =
          value.permissions.length !== currentPermissions.length ||
          value.permissions.some(
            (permission) => !currentPermissions.includes(permission),
          ) ||
          currentPermissions.some(
            (permission) => !value.permissions.includes(permission),
          );

        if (
          hasPermissionChanged &&
          value.permissions.some(
            (permission) =>
              !data.workspacePermissions.some(
                (option) =>
                  option.permission === permission && option.grantable,
              ),
          )
        ) {
          throw new Error("Selected permissions exceed your grant permissions");
        }

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

        if (
          memberId === currentMember.id &&
          (hasRolesChanged || hasPermissionChanged)
        ) {
          // Rebuild identity and abilities without refetching a route access may have revoked.
          window.location.assign("/user/workspaces");
          return;
        }

        await refetch();
        await router.invalidate();

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
    ability.can("write", createAbilitySubject("Member", member));

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
                  <RoleCheckboxGroup
                    label={t("member:details.form.role.label")}
                    options={data.workspaceRoles}
                    testIdPrefix="member-role"
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
                    disabled={!canManageRoles}
                  />
                )}
              </form.Field>

              <form.Field name="permissions">
                {(field) => (
                  <PermissionCheckboxGroup
                    options={getPermissionOptions(data.workspacePermissions)}
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
