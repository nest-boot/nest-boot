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
import z from "zod";
import { isEmpty, pick } from "lodash";
import { useCurrentMemberContext } from "../contexts/current-member-context";
import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
import { Link } from "@/components/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";
import { Button } from "@/components/thread-ui/button";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PagePrimaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
import { DataTable } from "@/components/thread-ui/data-table";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { MemberOrderField, MemberStatus } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  createDataFilterSelectSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";
import { truncateEmail } from "@/utils/truncate-email";
import {
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";
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

const REMOVE_MEMBER_FROM_MEMBERS_ROUTE = graphql(`
  mutation removeMemberFromMembersRoute($id: ID!) {
    removeMember(id: $id) {
      id
    }
  }
`);

const UPDATE_MEMBER_STATUS_FROM_MEMBERS_ROUTE = graphql(`
  mutation updateMemberStatusFromMembersRoute(
    $id: ID!
    $input: UpdateMemberInput!
  ) {
    updateMember(id: $id, input: $input) {
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
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      filterSchema: z
        .object({
          name: createDataFilterInputSearchSchema(z.string().max(255))
            .optional()
            .catch(undefined),
          email: createDataFilterInputSearchSchema(z.string().max(255))
            .optional()
            .catch(undefined),
          status: createDataFilterSelectSearchSchema(
            z.union([z.nativeEnum(MemberStatus), z.literal("ACTIVE")]),
            Object.values(MemberStatus).length + 1,
          )
            .optional()
            .catch(undefined),
          created_at: dataFilterDateSearchSchema.optional().catch(undefined),
        })
        .optional(),
      pageSize: 20,
      orderField: MemberOrderField,
      defaultOrderField: MemberOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function ScopedMembersComponent() {
  const { workspaceId } = Route.useParams();
  return <MembersComponent key={workspaceId} />;
}

function MembersComponent() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMember = useCurrentMemberContext();
  const ability = useAbility();
  const canReadInvitations = ability.can("read", "Invitation");
  const canCreateInvitation = ability.can("write", "Invitation");
  const canCancelInvitation = ability.can("write", "Invitation");
  const canUpdateMember = (member: object) =>
    ability.can("write", createAbilitySubject("Member", member));
  const canDeleteMember = (member: object) =>
    ability.can("write", createAbilitySubject("Member", member));
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
      ...pick(search, ["after", "before", "first", "last"]),
      query,
      filter: formatFilterValues(filterValues, formatConnectionFilterValue),
      orderBy: {
        field: search?.orderBy?.field ?? MemberOrderField.CREATED_AT,
        direction: search?.orderBy?.direction ?? OrderDirection.DESC,
      },
    },
  });

  const members =
    data?.currentWorkspace?.members.edges.map((edge) => edge.node) ?? [];
  const pendingInvitations =
    data?.currentWorkspace?.invitations?.edges.map(({ node }) => node) ?? [];
  const invitationPageInfo = data?.currentWorkspace?.invitations?.pageInfo;
  const pageInfo = data?.currentWorkspace?.members.pageInfo;

  const filters: Array<DataFilterItemProps> = useMemo(() => {
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

  const [removeMember, { loading: removeMemberLoading }] = useMutation(
    REMOVE_MEMBER_FROM_MEMBERS_ROUTE,
  );

  const [updateMemberStatus, { loading: updateStatusLoading }] = useMutation(
    UPDATE_MEMBER_STATUS_FROM_MEMBERS_ROUTE,
  );
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

  const handleRemoveMemberClick = async (memberId: string) => {
    const confirmed = await alertDialog({
      title: t("member:delete.title"),
      description: t("member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });

    if (!confirmed) return;

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

      toast.add({ type: "success", title: t("member:toast.deleted_success") });
      refetch();
    } catch (err) {
      if (err instanceof Error) {
        toast.add({ type: "error", title: err.message });
      }
    }
  };

  const handleToggleMemberStatus = async (
    memberId: string,
    currentStatus: MemberStatus | null | undefined,
  ) => {
    try {
      // Only toggle between active and disabled memberships.
      if (
        currentStatus !== MemberStatus.ACTIVE &&
        currentStatus !== MemberStatus.DISABLED
      ) {
        return;
      }

      const newStatus =
        currentStatus === MemberStatus.DISABLED
          ? MemberStatus.ACTIVE
          : MemberStatus.DISABLED;

      await updateMemberStatus({
        variables: {
          id: memberId,
          input: {
            status: newStatus,
          },
        },
      });

      toast.add({
        type: "success",
        title:
          newStatus === MemberStatus.DISABLED
            ? t("member:toast.disabled_success")
            : t("member:toast.enabled_success"),
      });
      if (
        memberId === currentMember.id &&
        newStatus === MemberStatus.DISABLED
      ) {
        await navigate({ to: "/user/workspaces" });
        return;
      }
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        toast.add({ type: "error", title: err.message });
      }
    }
  };

  return (
    <Page>
      <PageHeader>
        <Breadcrumbs />
        <PageTitle>{t("member:title")}</PageTitle>
        <PageDescription>{t("member:description")}</PageDescription>
        {canCreateInvitation ? (
          <PageActions>
            <PagePrimaryAction
              data-testid="members-invite-action"
              render={
                <Link
                  to="/workspaces/$workspaceId/members/invite"
                  params={{ workspaceId }}
                />
              }
            >
              {t("member:invite.button")}
            </PagePrimaryAction>
          </PageActions>
        ) : null}
      </PageHeader>
      <PageContent>
        <PageLayout>
          <PageLayoutSection>
            <Card>
              <CardContent>
                <div className="space-y-4">
                  <div data-testid="members-page">
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
                  </div>

                  <DataTable
                    columns={[
                      {
                        accessorKey: "name",
                        header: t("member:table.name"),
                        cell: ({ row }) => {
                          const member = row.original;
                          return (
                            <div
                              data-testid={`member-row-${member.email ?? member.id}`}
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
                      },
                      {
                        accessorKey: "roles",
                        header: t("member:table.role"),
                        cell: ({ row }) => {
                          return (
                            <Badge variant="outline">
                              {getRolesLabel(row.original.roles)}
                            </Badge>
                          );
                        },
                      },
                      {
                        accessorKey: "status",
                        header: t("member:table.status"),
                        cell: ({ row }) => {
                          const status = row.original.status;

                          const statusColorMap: Record<
                            MemberStatus,
                            "green" | "yellow" | "red" | "gray"
                          > = {
                            [MemberStatus.ACTIVE]: "green",
                            [MemberStatus.DISABLED]: "gray",
                          };

                          const color = status
                            ? statusColorMap[status]
                            : "green";

                          return (
                            <Badge
                              color={color}
                              data-testid={
                                status
                                  ? `member-status-${status.toLowerCase()}`
                                  : undefined
                              }
                            >
                              {getStatusLabel(status)}
                            </Badge>
                          );
                        },
                      },
                      {
                        accessorKey: "createdAt",
                        header: t("member:table.joined"),
                        cell: ({ row }) => {
                          return dayjs(row.original.createdAt).format(
                            "YYYY-MM-DD",
                          );
                        },
                      },
                    ]}
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
                    rowActions={(row) => [
                      ...(canUpdateMember(row.original) &&
                      (row.original.status === MemberStatus.ACTIVE ||
                        row.original.status === MemberStatus.DISABLED)
                        ? [
                            {
                              disabled: updateStatusLoading,
                              label:
                                row.original.status === MemberStatus.DISABLED
                                  ? t("action.enable")
                                  : t("action.disable"),
                              onClick: () =>
                                handleToggleMemberStatus(
                                  row.original.id,
                                  row.original.status,
                                ),
                            },
                          ]
                        : []),
                      ...(canDeleteMember(row.original) &&
                      row.original.id !== currentMember.id
                        ? [
                            {
                              disabled: removeMemberLoading,
                              label: t("action.delete"),
                              onClick: () =>
                                handleRemoveMemberClick(row.original.id),
                            },
                          ]
                        : []),
                    ]}
                    data={members}
                    pagination={{
                      hasPreviousPage: pageInfo?.hasPreviousPage,
                      hasNextPage: pageInfo?.hasNextPage,
                      onPreviousPage: () => {
                        navigate({
                          to: location.pathname,
                          search: getPreviousPageSearch(search, pageInfo),
                        });
                      },
                      onNextPage: () => {
                        navigate({
                          to: location.pathname,
                          search: getNextPageSearch(search, pageInfo),
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
              <Card data-testid="invitations">
                <CardHeader>
                  <CardTitle>{t("member:invite.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingInvitations.map((invitation) => (
                      <div
                        className="flex flex-col gap-4 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        data-testid={`invitation-${invitation.email}`}
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
                      </div>
                    ))}
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="outline"
                        disabled={!invitationPageInfo?.hasPreviousPage}
                        onClick={() =>
                          setInvitationPage({
                            last: 20,
                            before:
                              invitationPageInfo?.startCursor ?? undefined,
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
                  </div>
                </CardContent>
              </Card>
            </PageLayoutSection>
          ) : null}
        </PageLayout>
      </PageContent>
    </Page>
  );
}
