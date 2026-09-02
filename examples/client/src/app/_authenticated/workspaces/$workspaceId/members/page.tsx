import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { toast } from "sonner";
import z from "zod";
import { isEmpty, pick } from "lodash";
import { useCurrentWorkspaceMemberContext } from "../contexts/current-workspace-member-context";
import { InviteMemberDialog } from "./components/invite-member-dialog";
import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
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
import { graphql } from "@/gql";
import {
  WorkspaceMemberOrderField,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  WorkspaceMemberType,
} from "@/gql/graphql";
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

const GET_WORKSPACE_MEMBERS_FROM_MEMBERS_ROUTE = graphql(`
  query getWorkspaceMembersFromMembersRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: WorkspaceMemberFilter
    $orderBy: WorkspaceMemberOrder
    $query: String
  ) {
    workspaceMembers(
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
          id
          name
          email
          role
          status
          createdAt
          user {
            id
            name
            email
          }
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
`);

const REMOVE_WORKSPACE_MEMBER_FROM_MEMBERS_ROUTE = graphql(`
  mutation removeWorkspaceMemberFromMembersRoute($id: ID!) {
    removeWorkspaceMember(id: $id) {
      id
    }
  }
`);

const UPDATE_WORKSPACE_MEMBER_STATUS_FROM_MEMBERS_ROUTE = graphql(`
  mutation updateWorkspaceMemberStatusFromMembersRoute(
    $id: ID!
    $input: UpdateWorkspaceMemberInput!
  ) {
    updateWorkspaceMember(id: $id, input: $input) {
      id
      status
    }
  }
`);

const getRoleLabel = (role: WorkspaceMemberRole) => {
  switch (role) {
    case WorkspaceMemberRole.OWNER:
      return t("workspace-member:role.owner");
    case WorkspaceMemberRole.ADMIN:
      return t("workspace-member:role.admin");
    case WorkspaceMemberRole.MEMBER:
      return t("workspace-member:role.member");
    default:
      return role;
  }
};

const getTypeLabel = (type: WorkspaceMemberType) => {
  switch (type) {
    case WorkspaceMemberType.USER:
      return t("workspace-member:type.user");
    case WorkspaceMemberType.SERVICE_ACCOUNT:
      return t("workspace-member:type.service_account");
    default:
      return type;
  }
};

const statusMap = {
  [WorkspaceMemberStatus.INVITING]: t("workspace-member:status.inviting"),
  [WorkspaceMemberStatus.ACTIVE]: t("workspace-member:status.active"),
  [WorkspaceMemberStatus.INVITE_EXPIRED]: t(
    "workspace-member:status.invite_expired",
  ),
  [WorkspaceMemberStatus.DISABLED]: t("workspace-member:status.disabled"),
};

const getStatusLabel = (status: WorkspaceMemberStatus | null | undefined) => {
  if (!status) return null;

  switch (status) {
    case WorkspaceMemberStatus.INVITING:
      return statusMap[status];
    case WorkspaceMemberStatus.ACTIVE:
      return statusMap[status];
    case WorkspaceMemberStatus.INVITE_EXPIRED:
      return statusMap[status];
    case WorkspaceMemberStatus.DISABLED:
      return statusMap[status];
    default:
      return status;
  }
};

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/",
)({
  component: MembersComponent,
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      filterSchema: z
        .object({
          role: createDataFilterSelectSearchSchema(
            z.nativeEnum(WorkspaceMemberRole),
            Object.values(WorkspaceMemberRole).length,
          )
            .optional()
            .catch(undefined),
          type: createDataFilterSelectSearchSchema(
            z.nativeEnum(WorkspaceMemberType),
            Object.values(WorkspaceMemberType).length,
          )
            .optional()
            .catch(undefined),
          name: createDataFilterInputSearchSchema(z.string().max(255), {
            fulltext: true,
          })
            .optional()
            .catch(undefined),
          email: createDataFilterInputSearchSchema(z.string().max(255), {
            fulltext: true,
          })
            .optional()
            .catch(undefined),
          status: createDataFilterSelectSearchSchema(
            z.union([z.nativeEnum(WorkspaceMemberStatus), z.literal("ACTIVE")]),
            Object.values(WorkspaceMemberStatus).length + 1,
          )
            .optional()
            .catch(undefined),
          created_at: dataFilterDateSearchSchema.optional().catch(undefined),
        })
        .optional(),
      pageSize: 20,
      orderField: WorkspaceMemberOrderField,
      defaultOrderField: WorkspaceMemberOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function MembersComponent() {
  const search = Route.useSearch();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentWorkspaceMember = useCurrentWorkspaceMemberContext();

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, refetch } = useQuery(GET_WORKSPACE_MEMBERS_FROM_MEMBERS_ROUTE, {
    variables: {
      ...pick(search, ["after", "before", "first", "last"]),
      query,
      filter: formatFilterValues(filterValues, formatConnectionFilterValue),
      orderBy: {
        field: search?.orderBy?.field ?? WorkspaceMemberOrderField.CREATED_AT,
        direction: search?.orderBy?.direction ?? OrderDirection.DESC,
      },
    },
  });

  const members = data?.workspaceMembers.edges.map((edge) => edge.node) ?? [];
  const pageInfo = data?.workspaceMembers.pageInfo;

  const filters: Array<DataFilterItemProps> = useMemo(() => {
    return [
      {
        label: t("workspace-member:filter.items.name.label"),
        field: "name",
        type: "input",
        placeholder: t("workspace-member:filter.items.name.placeholder"),
        operators: ["$fulltext"],
        defaultOperator: "$fulltext",
      },
      {
        label: t("workspace-member:filter.items.email.label"),
        field: "email",
        type: "input",
        placeholder: t("workspace-member:filter.items.email.placeholder"),
        operators: ["$fulltext"],
        defaultOperator: "$fulltext",
      },
      {
        label: t("workspace-member:filter.items.status.label"),
        field: "status",
        type: "select",
        options: Object.values(WorkspaceMemberStatus).map((status) => ({
          label: statusMap[status],
          value: status,
        })),
        operators: ["$in"],
        defaultOperator: "$in",
      },
      {
        label: t("workspace-member:filter.items.role.label"),
        field: "role",
        type: "select",
        options: Object.values(WorkspaceMemberRole).map((role) => ({
          label: getRoleLabel(role),
          value: role,
        })),
        operators: ["$in"],
        defaultOperator: "$in",
      },
      {
        label: t("workspace-member:filter.items.type.label"),
        field: "type",
        type: "select",
        options: Object.values(WorkspaceMemberType).map((type) => ({
          label: getTypeLabel(type),
          value: type,
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
  }, []);

  const [removeWorkspaceMember, { loading: removeMemberLoading }] = useMutation(
    REMOVE_WORKSPACE_MEMBER_FROM_MEMBERS_ROUTE,
  );

  const [updateWorkspaceMemberStatus, { loading: updateStatusLoading }] =
    useMutation(UPDATE_WORKSPACE_MEMBER_STATUS_FROM_MEMBERS_ROUTE);

  const handleRemoveMemberClick = async (memberId: string) => {
    const confirmed = await alertDialog({
      title: t("workspace-member:delete.title"),
      description: t("workspace-member:delete.description"),
      cancelText: t("action.cancel"),
      confirmText: t("action.confirm"),
    });

    if (!confirmed) return;

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

      toast.success(t("workspace-member:toast.deleted_success"));
      refetch();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  const handleToggleMemberStatus = async (
    memberId: string,
    currentStatus: WorkspaceMemberStatus | null | undefined,
  ) => {
    try {
      // 只处理 ACTIVE 和 DISABLED 状态的切换
      if (
        currentStatus !== WorkspaceMemberStatus.ACTIVE &&
        currentStatus !== WorkspaceMemberStatus.DISABLED
      ) {
        return;
      }

      const newStatus =
        currentStatus === WorkspaceMemberStatus.DISABLED
          ? WorkspaceMemberStatus.ACTIVE
          : WorkspaceMemberStatus.DISABLED;

      await updateWorkspaceMemberStatus({
        variables: {
          id: memberId,
          input: {
            status: newStatus,
          },
        },
      });

      toast.success(
        newStatus === WorkspaceMemberStatus.DISABLED
          ? t("workspace-member:toast.disabled_success")
          : t("workspace-member:toast.enabled_success"),
      );
      refetch();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("workspace-member:title")}</PageTitle>
        <PageDescription>{t("workspace-member:description")}</PageDescription>
        <PageActions>
          <PagePrimaryAction
            data-testid="workspace-members-invite-action"
            onClick={() => setInviteOpen(true)}
          >
            {t("workspace-member:invite.button")}
          </PagePrimaryAction>
        </PageActions>
      </PageHeader>
      <PageContent>
        <div className="mb-4" data-testid="workspace-members-page">
          <DataFilter
            filters={filters}
            value={{ filter: filterValues, query }}
            onChange={(value) => {
              navigate({
                to: location.pathname,
                search: {
                  ...(value.query ? { query: value.query } : {}),
                  ...(!isEmpty(value.filter) ? { filter: value.filter } : {}),
                },
              });
            }}
            search={{
              placeholder: t("workspace-member:filter.search.placeholder"),
            }}
          />
        </div>

        <DataTable
          columns={[
            {
              accessorKey: "name",
              header: t("workspace-member:table.name"),
              cell: ({ row }) => {
                const member = row.original;
                return (
                  <div
                    data-testid={`workspace-member-row-${
                      member.email ?? member.user?.email ?? member.id
                    }`}
                    className={cn(
                      "flex flex-col",
                      currentWorkspaceMember.role ===
                        WorkspaceMemberRole.MEMBER &&
                        "pointer-events-none opacity-50",
                    )}
                  >
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {truncateEmail(member.email ?? "") ?? "-"}
                    </span>
                  </div>
                );
              },
            },
            {
              accessorKey: "role",
              header: t("workspace-member:table.role"),
              cell: ({ row }) => {
                return (
                  <Badge variant="outline">
                    {getRoleLabel(row.original.role)}
                  </Badge>
                );
              },
            },
            {
              accessorKey: "status",
              header: t("workspace-member:table.status"),
              cell: ({ row }) => {
                const status = row.original.status;

                const statusColorMap: Record<
                  WorkspaceMemberStatus,
                  "green" | "yellow" | "red" | "gray"
                > = {
                  [WorkspaceMemberStatus.ACTIVE]: "green",
                  [WorkspaceMemberStatus.INVITING]: "yellow",
                  [WorkspaceMemberStatus.INVITE_EXPIRED]: "red",
                  [WorkspaceMemberStatus.DISABLED]: "gray",
                };

                const color = status ? statusColorMap[status] : "green";

                return (
                  <Badge
                    color={color}
                    data-testid={
                      status
                        ? `workspace-member-status-${status.toLowerCase()}`
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
              header: t("workspace-member:table.joined"),
              cell: ({ row }) => {
                return dayjs(row.original.createdAt).format("YYYY-MM-DD");
              },
            },
          ]}
          onRowClick={(row) => {
            navigate({
              to: "/workspaces/$workspaceId/members/$memberId",
              params: {
                workspaceId,
                memberId: row.original.id,
              },
            });
          }}
          rowActions={(row) => [
            ...(row.original.status === WorkspaceMemberStatus.ACTIVE ||
            row.original.status === WorkspaceMemberStatus.DISABLED
              ? [
                  {
                    disabled: updateStatusLoading,
                    label:
                      row.original.status === WorkspaceMemberStatus.DISABLED
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
            {
              disabled: removeMemberLoading,
              label: t("action.delete"),
              onClick: () => handleRemoveMemberClick(row.original.id),
            },
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

        <InviteMemberDialog
          inviteOpen={inviteOpen}
          onInviteOpenChange={setInviteOpen}
          onSuccess={() => {
            refetch();
          }}
        />
      </PageContent>
    </Page>
  );
}
