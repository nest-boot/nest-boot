import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { isEmpty } from "lodash";
import type { DataFilterField } from "@/components/thread-ui/data-filter";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";
import { getWorkspaceMembersResourceKey } from "@/lib/resource-keys";
import { workspaceMemberSearchSchema } from "@/schemas/workspace-member-search-schema";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { Link } from "@/components/link";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";
import { Button } from "@/components/thread-ui/button";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Page } from "@/components/thread-ui/page";
import {
  DataTable,
  createDataTableColumnHelper,
} from "@/components/thread-ui/data-table";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { WorkspaceMemberStatus, WorkspaceMemberType } from "@/gql/graphql";
import { getNextSearch, getPreviousSearch } from "@/lib/graphql-connection";
import { truncateEmail } from "@/utils/truncate-email";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/thread-ui/badge";
import { getRolesLabel } from "@/utils/get-role-label";
import { createAbilitySubject } from "@/lib/ability";

const GET_WORKSPACE_MEMBERS_FROM_WORKSPACE_MEMBERS_ROUTE = graphql(`
  query getWorkspaceMembersFromWorkspaceMembersRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: WorkspaceMemberFilter
    $orderBy: WorkspaceMemberOrder
    $query: String
    $invitationFirst: Int
    $invitationLast: Int
    $invitationAfter: String
    $invitationBefore: String
    $invitationFilter: WorkspaceInvitationFilter
    $includeWorkspaceInvitations: Boolean! = false
  ) {
    selectedWorkspace {
      members(
        after: $after
        before: $before
        first: $first
        last: $last
        orderBy: $orderBy
        filter: $filter
        query: $query
      ) {
        edges {
          node {
            workspaceId
            id
            roles
            status
            type
            createdAt
            name
            email
          }
        }
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
      }
    }
    selectedWorkspace {
      invitations(
        first: $invitationFirst
        last: $invitationLast
        after: $invitationAfter
        before: $invitationBefore
        filter: $invitationFilter
        orderBy: { field: CREATED_AT, direction: DESC }
      ) @include(if: $includeWorkspaceInvitations) {
        edges {
          node {
            workspaceId
            id
            email
            roles
            status
            expiresAt
          }
        }
        pageInfo {
          endCursor
          startCursor
          hasNextPage
          hasPreviousPage
        }
      }
    }
  }
`);

const CANCEL_WORKSPACE_INVITATION_FROM_WORKSPACE_MEMBERS_ROUTE = graphql(`
  mutation cancelWorkspaceInvitationFromWorkspaceMembersRoute($id: ID!) {
    cancelWorkspaceInvitation(id: $id) {
      id
    }
  }
`);

const getStatusLabel = (status: WorkspaceMemberStatus | null | undefined) => {
  if (!status) return null;

  switch (status) {
    case WorkspaceMemberStatus.ACTIVE:
      return t("workspace-member:status.active");
    case WorkspaceMemberStatus.DISABLED:
      return t("workspace-member:status.disabled");
    default:
      return status;
  }
};

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/",
)({
  component: ScopedWorkspaceMembersComponent,
  beforeLoad: ({ context, params }) => {
    if (!context.ability.can("read", "WorkspaceMember")) {
      throw redirect({ to: "/workspaces/$workspaceId", params });
    }
  },
  validateSearch: zodValidator(workspaceMemberSearchSchema),
});

function ScopedWorkspaceMembersComponent() {
  const { workspaceId } = Route.useParams();
  return <WorkspaceMembersComponent key={workspaceId} />;
}

function WorkspaceMembersComponent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const { workspaceId } = Route.useParams();
  const currentUser = useAuthUserContext();
  useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceMembersResourceKey(workspaceId)],
    searchSchema: workspaceMemberSearchSchema,
    search,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const ability = useAbility();
  const canReadWorkspaceInvitations = ability.can(
    "read",
    "WorkspaceInvitation",
  );
  const canCreateWorkspaceInvitation = ability.can(
    "write",
    "WorkspaceInvitation",
  );
  const canCreateWorkspaceServiceAccount = ability.can(
    "write",
    createAbilitySubject("WorkspaceMember", {
      workspaceId,
      type: WorkspaceMemberType.SERVICE_ACCOUNT,
    }),
  );
  const canCancelWorkspaceInvitation = ability.can(
    "write",
    "WorkspaceInvitation",
  );
  const canEditWorkspaceMember = (member: object) =>
    ["write", "set-roles", "set-permissions"].some((action) =>
      ability.can(action, createAbilitySubject("WorkspaceMember", member)),
    );

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const [invitationPage, setWorkspaceInvitationPage] = useState<{
    first?: number;
    last?: number;
    after?: string;
    before?: string;
  }>({ first: 20 });

  const { data, refetch } = useQuery(
    GET_WORKSPACE_MEMBERS_FROM_WORKSPACE_MEMBERS_ROUTE,
    {
      fetchPolicy: "network-only",
      skip: !ability.can("read", "WorkspaceMember"),
      variables: {
        includeWorkspaceInvitations: canReadWorkspaceInvitations,
        invitationFirst: invitationPage.first,
        invitationLast: invitationPage.last,
        invitationAfter: invitationPage.after,
        invitationBefore: invitationPage.before,
        invitationFilter: { status: { $eq: "pending" } },
        ...search,
      },
    },
  );

  const members =
    data?.selectedWorkspace?.members.edges.map((edge) => edge.node) ?? [];
  const pendingWorkspaceInvitations =
    data?.selectedWorkspace?.invitations?.edges.map(({ node }) => node) ?? [];
  const invitationPageInfo = data?.selectedWorkspace?.invitations?.pageInfo;
  const pageInfo = data?.selectedWorkspace?.members.pageInfo;

  const membersColumnHelper =
    createDataTableColumnHelper<(typeof members)[number]>();
  const filters: Array<DataFilterField> = useMemo(() => {
    return [
      {
        label: t("workspace-member:filter.items.name.label"),
        field: "name",
        type: "input",
        placeholder: t("workspace-member:filter.items.name.placeholder"),
        operators: ["$eq"],
        defaultOperator: "$eq",
      },
      {
        label: t("workspace-member:filter.items.email.label"),
        field: "email",
        type: "input",
        placeholder: t("workspace-member:filter.items.email.placeholder"),
        operators: ["$eq"],
        defaultOperator: "$eq",
      },
      {
        label: t("workspace-member:table.type"),
        field: "type",
        type: "select",
        options: Object.values(WorkspaceMemberType).map((type) => ({
          value: type,
          label:
            type === WorkspaceMemberType.SERVICE_ACCOUNT
              ? t("workspace-member:type.service_account")
              : t("workspace-member:type.user"),
        })),
        operators: ["$in"],
        defaultOperator: "$in",
      },
      {
        label: t("workspace-member:filter.items.status.label"),
        field: "status",
        type: "select",
        options: Object.values(WorkspaceMemberStatus).map((status) => ({
          label: getStatusLabel(status) ?? status,
          value: status,
        })),
        operators: ["$in"],
        defaultOperator: "$in",
      },
      {
        label: t("workspace-member:filter.items.created_at.label"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ];
  }, [t]);

  const [
    cancelWorkspaceInvitation,
    { loading: cancelWorkspaceInvitationLoading },
  ] = useMutation(CANCEL_WORKSPACE_INVITATION_FROM_WORKSPACE_MEMBERS_ROUTE);

  const handleCopyWorkspaceInvitation = async (invitationId: string) => {
    const link = `${window.location.origin}/invite?invitationId=${invitationId}`;
    await navigator.clipboard.writeText(link);
    toast.add({
      type: "success",
      title: t("workspace-member:invite.link_copied"),
    });
  };

  const handleCancelWorkspaceInvitation = async (invitationId: string) => {
    const confirmed = await alertDialog({
      title: t("workspace-member:invite.title"),
      description: t("workspace-member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });
    if (!confirmed) return;

    await cancelWorkspaceInvitation({ variables: { id: invitationId } });
    await refreshAfterMutation(() => refetch());
  };

  return (
    <Page
      title={t("workspace-member:title")}
      description={t("workspace-member:description")}
      primaryAction={
        canCreateWorkspaceInvitation
          ? {
              render: (
                <Link
                  to="/workspaces/$workspaceId/members/invite"
                  params={{ workspaceId }}
                />
              ),
              label: t("workspace-member:invite.button"),
            }
          : undefined
      }
      secondaryActions={
        canCreateWorkspaceServiceAccount
          ? [
              {
                label: t("action.create"),
                render: (
                  <Link
                    to="/workspaces/$workspaceId/members/create-service-account"
                    params={{ workspaceId }}
                  />
                ),
              },
            ]
          : undefined
      }
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <div className="space-y-4">
                <DataFilter
                  filters={filters}
                  value={{ filter: filterValues, query }}
                  onChange={(value) => {
                    navigate({
                      to: location.pathname,
                      search: {
                        ...(value.query ? { query: value.query } : {}),
                        ...(!isEmpty(value.filter)
                          ? { filter: value.filter }
                          : {}),
                      },
                    });
                  }}
                  search={{
                    placeholder: t(
                      "workspace-member:filter.search.placeholder",
                    ),
                  }}
                />

                <DataTable
                  locale={i18n.resolvedLanguage}
                  columns={membersColumnHelper.columns([
                    membersColumnHelper.column("name", {
                      header: t("workspace-member:table.name"),
                      render: (props, { row }) => {
                        const member = row.original;
                        return (
                          <div
                            {...props}
                            className={cn(
                              "flex flex-col",
                              !canEditWorkspaceMember(member) &&
                                "pointer-events-none opacity-50",
                            )}
                          >
                            <span className="font-medium">
                              {member.name ?? member.id}
                            </span>
                            {member.type === WorkspaceMemberType.USER && (
                              <span className="text-muted-foreground text-xs">
                                {truncateEmail(member.email ?? "") ?? "-"}
                              </span>
                            )}
                          </div>
                        );
                      },
                    }),
                    membersColumnHelper.column("type", {
                      header: t("workspace-member:table.type"),
                      render: (props, { row }) => (
                        <Badge {...props} color={undefined} variant="outline">
                          {row.original.type ===
                          WorkspaceMemberType.SERVICE_ACCOUNT
                            ? t("workspace-member:type.service_account")
                            : t("workspace-member:type.user")}
                        </Badge>
                      ),
                    }),
                    membersColumnHelper.column("roles", {
                      header: t("workspace-member:table.role"),
                      render: (props, { row }) => {
                        if (!row.original.roles.length)
                          return <span {...props}>-</span>;
                        return (
                          <Badge {...props} color={undefined} variant="outline">
                            {getRolesLabel(row.original.roles)}
                          </Badge>
                        );
                      },
                    }),
                    membersColumnHelper.column("status", {
                      header: t("workspace-member:table.status"),
                      render: (props, { row }) => {
                        const status = row.original.status;

                        const statusColorMap: Record<
                          WorkspaceMemberStatus,
                          "green" | "yellow" | "red" | "gray"
                        > = {
                          [WorkspaceMemberStatus.ACTIVE]: "green",
                          [WorkspaceMemberStatus.DISABLED]: "gray",
                        };

                        const color = status ? statusColorMap[status] : "green";

                        return (
                          <Badge {...props} color={color}>
                            {getStatusLabel(status)}
                          </Badge>
                        );
                      },
                    }),
                    membersColumnHelper.column("createdAt", {
                      header: t("workspace-member:table.joined"),
                      type: "date",
                    }),
                  ])}
                  onRowClick={(row) => {
                    if (!canEditWorkspaceMember(row.original)) return;
                    navigate({
                      to: "/workspaces/$workspaceId/members/$memberId",
                      params: {
                        workspaceId,
                        memberId: row.original.id,
                      },
                    });
                  }}
                  data={members}
                  pagination={{
                    hasPreviousPage: pageInfo?.hasPreviousPage,
                    hasNextPage: pageInfo?.hasNextPage,
                    onPreviousPage: () => {
                      navigate({
                        to: location.pathname,
                        search: getPreviousSearch(search, pageInfo),
                      });
                    },
                    onNextPage: () => {
                      navigate({
                        to: location.pathname,
                        search: getNextSearch(search, pageInfo),
                      });
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </PageLayoutSection>

        {pendingWorkspaceInvitations.length > 0 ||
        invitationPage.after ||
        invitationPage.before ? (
          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("workspace-member:invite.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {pendingWorkspaceInvitations.map((invitation) => (
                    <li
                      className="flex flex-col gap-4 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                      key={invitation.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {invitation.email}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {getRolesLabel(invitation.roles)} ·{" "}
                          {dayjs(invitation.expiresAt).format(
                            "YYYY-MM-DD HH:mm",
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleCopyWorkspaceInvitation(invitation.id)
                          }
                        >
                          {t(
                            "workspace-member:details.actions.copy_invite_link",
                          )}
                        </Button>
                        {canCancelWorkspaceInvitation ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={cancelWorkspaceInvitationLoading}
                            onClick={() =>
                              handleCancelWorkspaceInvitation(invitation.id)
                            }
                          >
                            {t("action.cancel")}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled={!invitationPageInfo?.hasPreviousPage}
                    onClick={() =>
                      setWorkspaceInvitationPage({
                        last: 20,
                        before: invitationPageInfo?.startCursor ?? undefined,
                      })
                    }
                  >
                    {t("thread-ui:dataTable.previousPage")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!invitationPageInfo?.hasNextPage}
                    onClick={() =>
                      setWorkspaceInvitationPage({
                        first: 20,
                        after: invitationPageInfo?.endCursor ?? undefined,
                      })
                    }
                  >
                    {t("thread-ui:dataTable.nextPage")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PageLayoutSection>
        ) : null}
      </PageLayout>
    </Page>
  );
}
