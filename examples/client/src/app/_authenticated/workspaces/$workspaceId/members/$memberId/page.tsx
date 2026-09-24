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

import { useCurrentMemberContext } from "../../contexts/current-member-context";
import { MemberProfileForm } from "./components/member-profile-form";
import { MemberRolesForm } from "./components/member-roles-form";
import { MemberPermissionsForm } from "./components/member-permissions-form";
import type { MemberFormProps } from "./components/member-form-props";
import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";
import type { ResourceNavigationQueryOptions } from "@/hooks/use-resource-navigation";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { RecordNavigation } from "@/components/record-navigation";
import { getMembersResourceKey } from "@/lib/resource-keys";
import { memberSearchSchema } from "@/schemas/member-search-schema";
import { createConnectionCursor } from "@/lib/connection-cursor";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { createAbilitySubject } from "@/lib/ability";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_MEMBER_NEIGHBORS = graphql(`
  query getMemberNeighbors(
    $cursor: String!
    $query: String
    $filter: MemberFilter
    $orderBy: MemberOrder
  ) {
    currentWorkspace {
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

const REMOVE_MEMBER_FROM_MEMBER_ROUTE = graphql(`
  mutation removeMemberFromMemberRoute($id: ID!) {
    removeMember(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/$memberId/",
)({
  component: MemberPage,
  beforeLoad: async ({
    context: { apolloClient, ability, currentMember },
    params: { memberId, workspaceId },
  }) => {
    const denied = () =>
      redirect({
        to: "/workspaces/$workspaceId/members",
        params: { workspaceId },
      });
    if (!currentMember || !ability.can("read", "Member")) throw denied();
    const { data } = await apolloClient
      .query({
        query: GET_MEMBER_FROM_MEMBER_ROUTE,
        variables: { id: memberId },
        context: { headers: { "x-workspace-id": workspaceId } },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    if (
      !data?.member ||
      !ability.can("read", createAbilitySubject("Member", data.member))
    )
      throw denied();
    return {
      memberData: { ...data, member: data.member },
      title: data.member.name || t("member:details.title"),
    };
  },
});

function MemberPage() {
  const { memberData } = Route.useRouteContext();
  return <MemberDetails key={memberData.member.id} data={memberData} />;
}

function MemberDetails({
  data,
}: {
  data: GetMemberFromMemberRouteQuery & {
    member: NonNullable<GetMemberFromMemberRouteQuery["member"]>;
  };
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();
  const currentMember = useCurrentMemberContext();
  const ability = useAbility();
  const [saving, setSaving] = useState(false);
  const [removeMember, { loading: removing }] = useMutation(
    REMOVE_MEMBER_FROM_MEMBER_ROUTE,
  );
  const member = data.member;
  const [loadNeighbors] = useLazyQuery(GET_MEMBER_NEIGHBORS, {
    fetchPolicy: "network-only",
  });
  const currentUser = useCurrentUserContext();
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...getMembersResourceKey(workspaceId)],
    searchSchema: memberSearchSchema,
    query: useCallback(
      async ({
        search,
      }: ResourceNavigationQueryOptions<typeof memberSearchSchema>) => {
        const { query, filter, orderBy } =
          createConnectionQueryVariables(search);
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor: createConnectionCursor(member, search),
          },
          context: { headers: { "x-workspace-id": workspaceId } },
        });
        if (data?.currentWorkspace?.id !== workspaceId) return undefined;
        return {
          previousEdge: data.currentWorkspace.previous.edges[0],
          nextEdge: data.currentWorkspace.next.edges[0],
        };
      },
      [member, loadNeighbors, workspaceId],
    ),
  });
  const { previousEdge, nextEdge, backSearch } = navigation;
  const memberSubject = createAbilitySubject("Member", member);

  const save: MemberFormProps["onSave"] = async (
    operation,
    changesAuthorization = false,
  ) => {
    setSaving(true);
    try {
      await operation();
      if (member.id === currentMember.id && changesAuthorization) {
        // Do not refetch a route that the committed authorization change may have revoked.
        window.location.assign("/user/workspaces");
        return false;
      }
      await router.invalidate();
      toast.add({
        type: "success",
        title: t("member:details.toast.updated_success"),
      });
      return true;
    } catch (error) {
      toast.add({
        type: "error",
        title: t("member:details.toast.update_failed"),
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
        title: t("member:delete.title"),
        description: t("member:delete.description"),
        cancelText: t("action.cancel"),
        confirmText: t("action.confirm"),
      }))
    )
      return;
    try {
      await removeMember({
        variables: { id: member.id },
        update(cache, result) {
          if (!result.data?.removeMember) return;
          cache.evict({
            id: cache.identify({
              __typename: "Member",
              id: result.data.removeMember.id,
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
        title: t("member:details.toast.deleted_success"),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: t("member:details.toast.delete_failed"),
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <Page variant="compact" data-testid="member-detail-page">
      <PageHeader>
        <Breadcrumbs
          searchByPath={{ [`/workspaces/${workspaceId}/members`]: backSearch }}
        />
        <PageTitle>{member.name ?? member.id}</PageTitle>
        <PageActions>
          {member.id !== currentMember.id &&
            ability.can("write", memberSubject) && (
              <PageSecondaryAction
                data-testid="member-delete-action"
                destructive
                disabled={saving || removing}
                onAction={handleRemove}
              >
                {t("member:details.actions.delete_member")}
              </PageSecondaryAction>
            )}
          <RecordNavigation
            previousPath={
              previousEdge
                ? `/workspaces/${workspaceId}/members/${previousEdge.node.id}`
                : undefined
            }
            nextPath={
              nextEdge
                ? `/workspaces/${workspaceId}/members/${nextEdge.node.id}`
                : undefined
            }
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <PageLayout>
          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("member:details.sections.profile")}</CardTitle>
              </CardHeader>
              <MemberProfileForm
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
              <CardHeader>
                <CardTitle>{t("member:details.sections.roles")}</CardTitle>
              </CardHeader>
              <MemberRolesForm
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
              <CardHeader>
                <CardTitle>
                  {t("member:details.sections.permissions")}
                </CardTitle>
              </CardHeader>
              <MemberPermissionsForm
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
      </PageContent>
    </Page>
  );
}
