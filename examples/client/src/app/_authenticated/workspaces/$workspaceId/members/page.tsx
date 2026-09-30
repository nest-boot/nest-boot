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
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { getMembersResourceKey } from "@/lib/resource-keys";
import { memberSearchSchema } from "@/schemas/member-search-schema";
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
import { MemberStatus } from "@/gql/graphql";
import { getNextSearch, getPreviousSearch } from "@/lib/graphql-connection";
import { truncateEmail } from "@/utils/truncate-email";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/thread-ui/badge";
import { getRolesLabel } from "@/utils/get-role-label";
import { createAbilitySubject } from "@/lib/ability";

const GET_MEMBERS_FROM_MEMBERS_ROUTE = graphql(`
  query getMembersFromMembersRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: MemberFilter
    $orderBy: MemberOrder
    $query: String
    $invitationFirst: Int
    $invitationLast: Int
    $invitationAfter: String
    $invitationBefore: String
    $invitationFilter: InvitationFilter
    $includeInvitations: Boolean! = false
  ) {
    currentWorkspace {
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
    currentWorkspace {
      invitations(
        first: $invitationFirst
        last: $invitationLast
        after: $invitationAfter
        before: $invitationBefore
        filter: $invitationFilter
        orderBy: { field: CREATED_AT, direction: DESC }
      ) @include(if: $includeInvitations) {
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

const CANCEL_INVITATION_FROM_MEMBERS_ROUTE = graphql(`
  mutation cancelInvitationFromMembersRoute($id: ID!) {
    cancelInvitation(id: $id) {
      id
    }
  }
`);

const getStatusLabel = (status: MemberStatus | null | undefined) => {
  if (!status) return null;

  switch (status) {
    case MemberStatus.ACTIVE:
      return t("member:status.active");
    case MemberStatus.DISABLED:
      return t("member:status.disabled");
    default:
      return status;
  }
};

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/",
)({
  component: ScopedMembersComponent,
  beforeLoad: ({ context, params }) => {
    if (!context.ability.can("read", "Member")) {
      throw redirect({ to: "/workspaces/$workspaceId", params });
    }
  },
  validateSearch: zodValidator(memberSearchSchema),
});

function ScopedMembersComponent() {
  const { workspaceId } = Route.useParams();
  return <MembersComponent key={workspaceId} />;
}

function MembersComponent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const { workspaceId } = Route.useParams();
  const currentUser = useCurrentUserContext();
  useResourceNavigation({
    key: [currentUser.id, ...getMembersResourceKey(workspaceId)],
    searchSchema: memberSearchSchema,
    search,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const ability = useAbility();
  const canReadInvitations = ability.can("read", "Invitation");
  const canCreateInvitation = ability.can("write", "Invitation");
  const canCancelInvitation = ability.can("write", "Invitation");
  const canEditMember = (member: object) =>
    ["write", "set-roles", "set-permissions"].some((action) =>
      ability.can(action, createAbilitySubject("Member", member)),
    );

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const [invitationPage, setInvitationPage] = useState<{
    first?: number;
    last?: number;
    after?: string;
    before?: string;
  }>({ first: 20 });

  const { data, refetch } = useQuery(GET_MEMBERS_FROM_MEMBERS_ROUTE, {
    fetchPolicy: "network-only",
    skip: !ability.can("read", "Member"),
    variables: {
      includeInvitations: canReadInvitations,
      invitationFirst: invitationPage.first,
      invitationLast: invitationPage.last,
      invitationAfter: invitationPage.after,
      invitationBefore: invitationPage.before,
      invitationFilter: { status: { $eq: "pending" } },
      ...search,
    },
  });

  const members =
    data?.currentWorkspace?.members.edges.map((edge) => edge.node) ?? [];
  const pendingInvitations =
    data?.currentWorkspace?.invitations?.edges.map(({ node }) => node) ?? [];
  const invitationPageInfo = data?.currentWorkspace?.invitations?.pageInfo;
  const pageInfo = data?.currentWorkspace?.members.pageInfo;

  const membersColumnHelper =
    createDataTableColumnHelper<(typeof members)[number]>();
  const filters: Array<DataFilterField> = useMemo(() => {
    return [
      {
        label: t("member:filter.items.name.label"),
        field: "name",
        type: "input",
        placeholder: t("member:filter.items.name.placeholder"),
        operators: ["$eq"],
        defaultOperator: "$eq",
      },
      {
        label: t("member:filter.items.email.label"),
        field: "email",
        type: "input",
        placeholder: t("member:filter.items.email.placeholder"),
        operators: ["$eq"],
        defaultOperator: "$eq",
      },
      {
        label: t("member:filter.items.status.label"),
        field: "status",
        type: "select",
        options: Object.values(MemberStatus).map((status) => ({
          label: getStatusLabel(status) ?? status,
          value: status,
        })),
        operators: ["$in"],
        defaultOperator: "$in",
      },
      {
        label: t("member:filter.items.created_at.label"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ];
  }, [t]);

  const [cancelInvitation, { loading: cancelInvitationLoading }] = useMutation(
    CANCEL_INVITATION_FROM_MEMBERS_ROUTE,
  );

  const handleCopyInvitation = async (invitationId: string) => {
    const link = `${window.location.origin}/invite?invitationId=${invitationId}`;
    await navigator.clipboard.writeText(link);
    toast.add({ type: "success", title: t("member:invite.link_copied") });
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const confirmed = await alertDialog({
      title: t("member:invite.title"),
      description: t("member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });
    if (!confirmed) return;

    await cancelInvitation({ variables: { id: invitationId } });
    await refetch();
  };

  return (
    <Page
      title={t("member:title")}
      description={t("member:description")}
      primaryAction={
        canCreateInvitation
          ? {
              render: (
                <Link
                  to="/workspaces/$workspaceId/members/invite"
                  params={{ workspaceId }}
                />
              ),
              label: t("member:invite.button"),
            }
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
                    placeholder: t("member:filter.search.placeholder"),
                  }}
                />

                <DataTable
                  locale={i18n.resolvedLanguage}
                  columns={membersColumnHelper.columns([
                    membersColumnHelper.column("name", {
                      header: t("member:table.name"),
                      render: (props, { row }) => {
                        const member = row.original;
                        return (
                          <div
                            {...props}
                            className={cn(
                              "flex flex-col",
                              !canEditMember(member) &&
                                "pointer-events-none opacity-50",
                            )}
                          >
                            <span className="font-medium">
                              {member.name ?? member.id}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {truncateEmail(member.email ?? "") ?? "-"}
                            </span>
                          </div>
                        );
                      },
                    }),
                    membersColumnHelper.column("roles", {
                      header: t("member:table.role"),
                      render: (props, { row }) => {
                        return (
                          <Badge {...props} color={undefined} variant="outline">
                            {getRolesLabel(row.original.roles)}
                          </Badge>
                        );
                      },
                    }),
                    membersColumnHelper.column("status", {
                      header: t("member:table.status"),
                      render: (props, { row }) => {
                        const status = row.original.status;

                        const statusColorMap: Record<
                          MemberStatus,
                          "green" | "yellow" | "red" | "gray"
                        > = {
                          [MemberStatus.ACTIVE]: "green",
                          [MemberStatus.DISABLED]: "gray",
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
                      header: t("member:table.joined"),
                      type: "date",
                    }),
                  ])}
                  onRowClick={(row) => {
                    if (!canEditMember(row.original)) return;
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

        {pendingInvitations.length > 0 ||
        invitationPage.after ||
        invitationPage.before ? (
          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("member:invite.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {pendingInvitations.map((invitation) => (
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
                          onClick={() => handleCopyInvitation(invitation.id)}
                        >
                          {t("member:details.actions.copy_invite_link")}
                        </Button>
                        {canCancelInvitation ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={cancelInvitationLoading}
                            onClick={() =>
                              handleCancelInvitation(invitation.id)
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
                      setInvitationPage({
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
                      setInvitationPage({
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
