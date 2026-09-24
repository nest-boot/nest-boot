import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { isEmpty } from "lodash";
import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import {
  adminUserSearchSchema,
  adminUsersPageKey,
} from "@/lib/admin-user-search";
import { usePageSearch } from "@/hooks/use-page-search";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { Link } from "@/components/link";
import { useAbility } from "@/contexts/ability-context";

import { createAbilitySubject } from "@/lib/ability";
import { Badge } from "@/components/thread-ui/badge";
import { DataTable } from "@/components/thread-ui/data-table";
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PagePrimaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
import { graphql } from "@/gql";
import {
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";
import { Card, CardContent } from "@/components/ui/card";

const GET_USERS_FROM_USERS_ROUTE = graphql(`
  query getUsersFromUsersRoute(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $filter: UserFilter
    $query: String
    $orderBy: UserOrder
  ) {
    users(
      first: $first
      last: $last
      after: $after
      before: $before
      filter: $filter
      query: $query
      orderBy: $orderBy
    ) {
      edges {
        node {
          id
          name
          email
          emailVerified
          banned
          createdAt
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`);

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminUsersPage,
  beforeLoad: () => ({ title: t("admin:users.title") }),
  validateSearch: zodValidator(adminUserSearchSchema),
});

function AdminUsersPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  usePageSearch({
    key: adminUsersPageKey,
    searchSchema: adminUserSearchSchema,
    search,
  });
  const navigate = useNavigate();
  const ability = useAbility();
  const query = search.query ?? "";
  const filterValues = (search.filter ?? {}) as Record<string, unknown>;
  const { data, loading } = useQuery(GET_USERS_FROM_USERS_ROUTE, {
    fetchPolicy: "network-only",
    variables: createConnectionQueryVariables(search),
  });
  const users = data?.users.edges.map(({ node }) => node) ?? [];
  const canCreate = ability.can("create", "User");
  const filters: Array<DataFilterItemProps> = useMemo(
    () => [
      {
        label: t("admin:users.table.name"),
        field: "name",
        type: "input",
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("admin:users.table.email"),
        field: "email",
        type: "input",
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("admin:users.table.created_at"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ],
    [t],
  );

  return (
    <Page data-testid="admin-users-page">
      <PageHeader>
        <PageTitle>{t("admin:users.title")}</PageTitle>
        <PageDescription>{t("admin:users.description")}</PageDescription>
        {canCreate ? (
          <PageActions>
            <PagePrimaryAction render={<Link to="/admin/users/create" />}>
              <Plus data-icon="inline-start" />
              {t("admin:users.create.action")}
            </PagePrimaryAction>
          </PageActions>
        ) : null}
      </PageHeader>
      <PageContent>
        <Card>
          <CardContent>
            <div className="space-y-4">
              <DataFilter
                filters={filters}
                loading={loading}
                value={{ filter: filterValues, query }}
                search={{ placeholder: t("admin:users.search") }}
                onChange={(value) => {
                  navigate({
                    to: "/admin/users",
                    search: {
                      query: value.query || undefined,
                      filter: isEmpty(value.filter) ? undefined : value.filter,
                      orderBy: search.orderBy,
                    },
                  });
                }}
              />

              <DataTable
                data={users}
                columns={[
                  {
                    accessorKey: "name",
                    header: t("admin:users.table.name"),
                    cell: ({ row }) => (
                      <div>
                        <p className="font-medium">{row.original.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {row.original.email}
                        </p>
                      </div>
                    ),
                  },
                  {
                    accessorKey: "emailVerified",
                    header: t("admin:users.table.email_status"),
                    cell: ({ row }) => (
                      <Badge
                        color={row.original.emailVerified ? "green" : "gray"}
                      >
                        {t(
                          row.original.emailVerified
                            ? "admin:users.verified"
                            : "admin:users.unverified",
                        )}
                      </Badge>
                    ),
                  },
                  {
                    accessorKey: "banned",
                    header: t("admin:users.table.status"),
                    cell: ({ row }) => (
                      <Badge color={row.original.banned ? "red" : "green"}>
                        {t(
                          row.original.banned
                            ? "admin:users.banned"
                            : "admin:users.active",
                        )}
                      </Badge>
                    ),
                  },
                  {
                    accessorKey: "createdAt",
                    header: t("admin:users.table.created_at"),
                    cell: ({ row }) =>
                      dayjs(row.original.createdAt).format("YYYY-MM-DD"),
                  },
                ]}
                onRowClick={(row) => {
                  if (
                    !ability.can(
                      "read",
                      createAbilitySubject("User", row.original),
                    )
                  )
                    return;
                  navigate({
                    to: "/admin/users/$userId",
                    params: { userId: row.original.id },
                  });
                }}
                pagination={{
                  hasPreviousPage:
                    data?.users.pageInfo.hasPreviousPage ?? false,
                  hasNextPage: data?.users.pageInfo.hasNextPage ?? false,
                  onPreviousPage: () =>
                    navigate({
                      to: "/admin/users",
                      search: getPreviousPageSearch(
                        search,
                        data?.users.pageInfo,
                      ),
                    }),
                  onNextPage: () =>
                    navigate({
                      to: "/admin/users",
                      search: getNextPageSearch(search, data?.users.pageInfo),
                    }),
                }}
              />
              {loading ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  {t("admin:users.loading")}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
