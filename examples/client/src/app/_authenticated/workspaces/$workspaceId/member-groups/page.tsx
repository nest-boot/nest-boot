import { useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";

import z from "zod";
import { isEmpty, pick } from "lodash";
import { useMemo } from "react";
import { useCurrentWorkspaceMemberContext } from "../contexts/current-workspace-member-context";
import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
import { DataFilter } from "@/components/thread-ui/data-filter";
import {
  Page,
  PageActions,
  PageContent,
  PageHeader,
  PagePrimaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
import { DataTable } from "@/components/thread-ui/data-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { graphql } from "@/gql";
import {
  WorkspaceMemberGroupOrderField,
  WorkspaceMemberRole,
} from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";
import {
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";

export const GET_WORKSPACE_MEMBER_GROUPS_FROM_MEMBER_GROUPS_ROUTE = graphql(`
  query getWorkspaceMemberGroupsFromMemberGroupsRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: WorkspaceMemberGroupFilter
    $orderBy: WorkspaceMemberGroupOrder
    $query: String
  ) {
    workspaceMemberGroups(
      after: $after
      before: $before
      first: $first
      last: $last
      filter: $filter
      orderBy: $orderBy
      query: $query
    ) {
      edges {
        node {
          id
          name
          description
          createdAt
        }
        cursor
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

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/member-groups/",
)({
  component: MemberGroupsComponent,
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      filterSchema: z
        .object({
          name: createDataFilterInputSearchSchema(z.string().max(255), {
            fulltext: true,
          })
            .optional()
            .catch(undefined),
          description: createDataFilterInputSearchSchema(z.string().max(255), {
            fulltext: true,
          })
            .optional()
            .catch(undefined),
          created_at: dataFilterDateSearchSchema.optional().catch(undefined),
        })
        .optional(),
      pageSize: 20,
      orderField: WorkspaceMemberGroupOrderField,
      defaultOrderField: WorkspaceMemberGroupOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function MemberGroupsComponent() {
  const search = Route.useSearch();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentWorkspaceMember = useCurrentWorkspaceMemberContext();

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const { data } = useQuery(
    GET_WORKSPACE_MEMBER_GROUPS_FROM_MEMBER_GROUPS_ROUTE,
    {
      variables: {
        ...pick(search, ["after", "before", "first", "last"]),
        query,
        filter: formatFilterValues(filterValues, formatConnectionFilterValue),
        orderBy: {
          field:
            search?.orderBy?.field ?? WorkspaceMemberGroupOrderField.CREATED_AT,
          direction: search?.orderBy?.direction ?? OrderDirection.DESC,
        },
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const memberGroups =
    data?.workspaceMemberGroups.edges.map((edge) => edge.node) ?? [];
  const pageInfo = data?.workspaceMemberGroups.pageInfo;

  const canCreateAndViewDetail = [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
  ].includes(currentWorkspaceMember.role);

  const filters: Array<DataFilterItemProps> = useMemo(() => {
    return [
      {
        label: t("workspace-member-group:filter.items.name.label"),
        field: "name",
        type: "input",
        placeholder: t("workspace-member-group:filter.items.name.placeholder"),
        operators: ["$fulltext"],
        defaultOperator: "$fulltext",
      },
      {
        label: t("workspace-member-group:filter.items.description.label"),
        field: "description",
        type: "input",
        placeholder: t(
          "workspace-member-group:filter.items.description.placeholder",
        ),
        operators: ["$fulltext"],
        defaultOperator: "$fulltext",
      },
      {
        label: t("workspace-member-group:filter.items.created_at.label"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ];
  }, []);

  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("workspace-member-group:title")}</PageTitle>
        {canCreateAndViewDetail && (
          <PageActions>
            <PagePrimaryAction
              data-testid="member-group-create-action"
              onClick={() =>
                navigate({
                  to: "/workspaces/$workspaceId/member-groups/create",
                  params: { workspaceId },
                })
              }
            >
              {t("action.create")}
            </PagePrimaryAction>
          </PageActions>
        )}
      </PageHeader>
      <PageContent>
        <div className="mb-4" data-testid="member-groups-page">
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
              placeholder: t(
                "workspace-member-group:filter.search.placeholder",
              ),
            }}
          />
        </div>

        <DataTable
          columns={[
            {
              accessorKey: "name",
              header: t("workspace-member-group:table.name"),
              cell: ({ row }) => {
                const memberGroup = row.original;
                return (
                  <span data-testid={`member-group-row-${memberGroup.name}`}>
                    {memberGroup.name}
                  </span>
                );
              },
            },
            {
              accessorKey: "description",
              header: t("workspace-member-group:table.description"),
              cell: ({ row }) => {
                const description = row.original.description;

                if (!description) {
                  return (
                    <span className="text-muted-foreground">{description}</span>
                  );
                }

                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div className="line-clamp-1 max-w-[200px] truncate">
                            {description}
                          </div>
                        }
                      />
                      <TooltipContent>
                        <p className="max-w-md wrap-break-word">
                          {description}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              },
            },
            {
              accessorKey: "createdAt",
              header: t("workspace-member-group:table.createdAt"),
              cell: ({ row }) => {
                return row.original.createdAt
                  ? dayjs(row.original.createdAt).format("YYYY-MM-DD")
                  : "-";
              },
            },
          ]}
          onRowClick={
            canCreateAndViewDetail
              ? (row) => {
                  navigate({
                    to: "/workspaces/$workspaceId/member-groups/$memberGroupId",
                    params: {
                      workspaceId,
                      memberGroupId: row.original.id,
                    },
                  });
                }
              : undefined
          }
          rowActions={
            canCreateAndViewDetail
              ? (row) => [
                  {
                    label: t("action.edit"),
                    onClick: () => {
                      navigate({
                        to: "/workspaces/$workspaceId/member-groups/$memberGroupId",
                        params: {
                          workspaceId,
                          memberGroupId: row.original.id,
                        },
                      });
                    },
                  },
                ]
              : undefined
          }
          data={memberGroups}
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
      </PageContent>
    </Page>
  );
}
