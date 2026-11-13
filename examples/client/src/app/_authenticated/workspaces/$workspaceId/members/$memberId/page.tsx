import { useCallback, useState } from "react";
import { useLazyQuery, useMutation } from "@apollo/client/react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";

import { useAuthWorkspaceMemberContext } from "../../contexts/auth-workspace-member-context";
import { WorkspaceMemberProfileForm } from "./components/workspace-member-profile-form";
import { WorkspaceMemberRolesForm } from "./components/workspace-member-roles-form";
import { WorkspaceMemberPermissionsForm } from "./components/workspace-member-permissions-form";
import type { WorkspaceMemberFormProps } from "./components/workspace-member-form-props";
import type { GetWorkspaceMemberFromWorkspaceMemberRouteQuery } from "@/gql/graphql";
import type { ResourceNavigationQueryOptions } from "@/hooks/use-resource-navigation";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { Link } from "@/components/link";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { getWorkspaceMembersResourceKey } from "@/lib/resource-keys";
import { workspaceMemberSearchSchema } from "@/schemas/workspace-member-search-schema";
import { createConnectionCursor } from "@/lib/graphql-connection";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Page } from "@/components/thread-ui/page";
import { Card } from "@/components/ui/card";
import { WorkspaceMemberStatus } from "@/gql/graphql";
import { graphql } from "@/gql";
import { createAbilitySubject } from "@/lib/ability";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_WORKSPACE_MEMBER_NEIGHBORS = graphql(`
  query getWorkspaceMemberNeighbors(
    $cursor: String!
    $query: String
    $filter: WorkspaceMemberFilter
    $orderBy: WorkspaceMemberOrder
  ) {
    selectedWorkspace {
      id
      previous: members(
        last: 1
        before: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
      next: members(
        first: 1
        after: $cursor
        query: $query
        filter: $filter
        orderBy: $orderBy
      ) {
        edges {
          cursor
          node {
            id
          }
        }
      }
    }
  }
`);

const GET_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_ROUTE = graphql(`
  query getWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {
    workspaceMember(id: $id) {
      workspaceId
      id
      roles
      permissions
      type
      status
      name
      email
      createdAt
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

const REMOVE_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_ROUTE = graphql(`
  mutation removeWorkspaceMemberFromWorkspaceMemberRoute($id: ID!) {
    removeWorkspaceMember(id: $id) {
      id
    }
  }
`);

const UPDATE_WORKSPACE_MEMBER_STATUS_FROM_WORKSPACE_MEMBERS_ROUTE = graphql(`
  mutation updateWorkspaceMemberStatusFromWorkspaceMembersRoute(
    $id: ID!
    $input: UpdateWorkspaceMemberInput!
  ) {
    updateWorkspaceMember(id: $id, input: $input) {
      id
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/$memberId/",
)({
  component: WorkspaceMemberPage,
  beforeLoad: async ({
    context: { apolloClient, ability, currentWorkspaceMember },
    params: { memberId, workspaceId },
  }) => {
    const denied = () =>
      redirect({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    if (!currentWorkspaceMember || !ability.can("read", "WorkspaceMember"))
      throw denied();
    const { data } = await apolloClient
      .query({
        query: GET_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_ROUTE,
        variables: { id: memberId },
        context: { headers: { "x-workspace-id": workspaceId } },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    if (
      !data?.workspaceMember ||
      !ability.can(
        "read",
        createAbilitySubject("WorkspaceMember", data.workspaceMember),
      )
    )
      throw denied();
    return {
      memberData: { ...data, workspaceMember: data.workspaceMember },
      title: data.workspaceMember.name || t("workspace-member:details.title"),
    };
  },
});

function WorkspaceMemberPage() {
  const { memberData } = Route.useRouteContext();
  return (
    <WorkspaceMemberDetails
      key={memberData.workspaceMember.id}
      data={memberData}
    />
  );
}

function WorkspaceMemberDetails({
  data,
}: {
  data: GetWorkspaceMemberFromWorkspaceMemberRouteQuery & {
    workspaceMember: NonNullable<
      GetWorkspaceMemberFromWorkspaceMemberRouteQuery["workspaceMember"]
    >;
  };
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();
  const currentWorkspaceMember = useAuthWorkspaceMemberContext();
  const ability = useAbility();
  const [updateWorkspaceMemberStatus] = useMutation(
    UPDATE_WORKSPACE_MEMBER_STATUS_FROM_WORKSPACE_MEMBERS_ROUTE,
  );
  const [saving, setSaving] = useState(false);
  const [removeWorkspaceMember, { loading: removing }] = useMutation(
    REMOVE_WORKSPACE_MEMBER_FROM_WORKSPACE_MEMBER_ROUTE,
  );
  const member = data.workspaceMember;
  const [loadNeighbors] = useLazyQuery(GET_WORKSPACE_MEMBER_NEIGHBORS, {
    fetchPolicy: "network-only",
  });
  const currentUser = useAuthUserContext();
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceMembersResourceKey(workspaceId)],
    searchSchema: workspaceMemberSearchSchema,
    query: useCallback(
      async ({
        search,
      }: ResourceNavigationQueryOptions<
        typeof workspaceMemberSearchSchema
      >) => {
        const { query, filter, orderBy } = search;
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor: createConnectionCursor(member, search),
          },
          context: { headers: { "x-workspace-id": workspaceId } },
        });
        if (data?.selectedWorkspace?.id !== workspaceId) return undefined;
        return {
          previousEdge: data.selectedWorkspace.previous.edges[0],
          nextEdge: data.selectedWorkspace.next.edges[0],
        };
      },
      [member, loadNeighbors, workspaceId],
    ),
  });
  const { previousEdge, nextEdge, backSearch } = navigation;
  const memberSubject = createAbilitySubject("WorkspaceMember", member);

  const save: WorkspaceMemberFormProps["onSave"] = async (
    operation,
    changesAuthorization = false,
  ) => {
    setSaving(true);
    try {
      await operation();
      if (member.id === currentWorkspaceMember.id && changesAuthorization) {
        // Do not refetch a route that the committed authorization change may have revoked.
        window.location.assign("/user/workspaces");
        return false;
      }
      await refreshAfterMutation(() => router.invalidate());
      toast.add({
        type: "success",
        title: t("workspace-member:details.toast.updated_success"),
      });
      return true;
    } catch (error) {
      toast.add({
        type: "error",
        title: t("workspace-member:details.toast.update_failed"),
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (
      !(await alertDialog({
        title: t("workspace-member:delete.title"),
        description: t("workspace-member:delete.description"),
        cancelText: t("action.cancel"),
        confirmText: t("action.confirm"),
      }))
    )
      return;
    try {
      await removeWorkspaceMember({
        variables: { id: member.id },
        update(cache, result) {
          if (!result.data?.removeWorkspaceMember) return;
          cache.evict({
            id: cache.identify({
              __typename: "WorkspaceMember",
              id: result.data.removeWorkspaceMember.id,
            }),
          });
          cache.gc();
        },
      });
      await navigate({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
        search: backSearch,
      });
      toast.add({
        type: "success",
        title: t("workspace-member:details.toast.deleted_success"),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: t("workspace-member:details.toast.delete_failed"),
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <Page
      variant="compact"
      title={member.name ?? member.id}
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
      paginationActions={{
        previous: {
          disabled: !previousEdge,
          render: previousEdge ? (
            <Link
              to={`/workspaces/${workspaceId}/members/` + previousEdge.node.id}
            />
          ) : undefined,
        },
        next: {
          disabled: !nextEdge,
          render: nextEdge ? (
            <Link
              to={`/workspaces/${workspaceId}/members/` + nextEdge.node.id}
            />
          ) : undefined,
        },
      }}
      secondaryActions={
        ability.can("write", memberSubject)
          ? [
              ...(ability.can("write", memberSubject, "status") &&
              [
                WorkspaceMemberStatus.ACTIVE,
                WorkspaceMemberStatus.DISABLED,
              ].includes(member.status)
                ? [
                    {
                      label: t(
                        member.status === WorkspaceMemberStatus.DISABLED
                          ? "action.enable"
                          : "action.disable",
                      ),
                      disabled: saving || removing,
                      onAction: () =>
                        save(
                          () =>
                            updateWorkspaceMemberStatus({
                              variables: {
                                id: member.id,
                                input: {
                                  status:
                                    member.status ===
                                    WorkspaceMemberStatus.DISABLED
                                      ? WorkspaceMemberStatus.ACTIVE
                                      : WorkspaceMemberStatus.DISABLED,
                                },
                              },
                            }),
                          true,
                        ),
                    },
                  ]
                : []),
              ...(member.id !== currentWorkspaceMember.id
                ? [
                    {
                      label: t("action.delete"),
                      destructive: true,
                      disabled: saving || removing,
                      onAction: handleRemove,
                    },
                  ]
                : []),
            ]
          : undefined
      }
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <WorkspaceMemberProfileForm
              member={member}
              onSave={save}
              disabled={
                saving || removing || !ability.can("write", memberSubject)
              }
            />
          </Card>
        </PageLayoutSection>
        <PageLayoutSection>
          <Card>
            <WorkspaceMemberRolesForm
              member={member}
              onSave={save}
              options={data.workspaceRoles}
              disabled={
                saving || removing || !ability.can("set-roles", memberSubject)
              }
            />
          </Card>
        </PageLayoutSection>
        <PageLayoutSection>
          <Card>
            <WorkspaceMemberPermissionsForm
              member={member}
              onSave={save}
              options={data.workspacePermissions}
              disabled={
                saving ||
                removing ||
                !ability.can("set-permissions", memberSubject)
              }
            />
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
