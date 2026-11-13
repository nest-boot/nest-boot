import { useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { graphql } from "@/gql";
import { Page } from "@/components/thread-ui/page";
import {
  DataTable,
  createDataTableColumnHelper,
} from "@/components/thread-ui/data-table";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { Badge } from "@/components/thread-ui/badge";
import { Link } from "@/components/link";
import { Card, CardContent } from "@/components/ui/card";
import { OverviewError } from "@/components/overview-card";
import { useAbility } from "@/contexts/ability-context";
import { createAbilitySubject } from "@/lib/ability";
import { getNextSearch, getPreviousSearch } from "@/lib/graphql-connection";
import { systemAccountSearchSchema } from "@/schemas/system-account-search-schema";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";

const LIST = graphql(`
  query managedSystemAccounts(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $query: String
    $filter: SystemAccountFilter
    $orderBy: SystemAccountOrder
  ) {
    systemAccounts(
      first: $first
      last: $last
      after: $after
      before: $before
      query: $query
      filter: $filter
      orderBy: $orderBy
    ) {
      edges {
        node {
          id
          name
          enabled
          permissions
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`);
export const Route = createFileRoute("/_authenticated/admin/system-accounts/")({
  component: Accounts,
  validateSearch: zodValidator(systemAccountSearchSchema),
});
function Accounts() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ability = useAbility();
  const user = useAuthUserContext();
  useResourceNavigation({
    key: [user.id, "admin", "system-accounts"],
    searchSchema: systemAccountSearchSchema,
    search,
  });
  const { data, loading, error, refetch } = useQuery(LIST, {
    variables: search,
    fetchPolicy: "network-only",
  });
  const rows = data?.systemAccounts.edges.map(({ node }) => node) ?? [];
  const columns = createDataTableColumnHelper<(typeof rows)[number]>();
  return (
    <Page
      title={t("admin:system_accounts.title")}
      description={t("admin:system_accounts.description")}
      primaryAction={
        ability.can("write", "SystemAccount")
          ? {
              label: t("action.create"),
              render: <Link to="/admin/system-accounts/create" />,
            }
          : undefined
      }
    >
      {error ? (
        <OverviewError
          onRetry={() => {
            void refetch().catch(() => undefined);
          }}
        />
      ) : (
        <Card>
          <CardContent>
            <div className="space-y-4">
              <DataFilter
                loading={loading}
                filters={[
                  {
                    label: t("admin:users.table.name"),
                    field: "name",
                    type: "input",
                    operators: ["$eq", "$ne"],
                    defaultOperator: "$eq",
                  },
                ]}
                value={{
                  query: search.query ?? "",
                  filter: search.filter ?? {},
                }}
                search={{ placeholder: t("admin:system_accounts.search") }}
                onChange={(value) => {
                  void navigate({
                    to: "/admin/system-accounts",
                    search: {
                      query: value.query || undefined,
                      filter: Object.keys(value.filter).length
                        ? value.filter
                        : undefined,
                      orderBy: search.orderBy,
                    },
                  });
                }}
              />
              <DataTable
                locale={i18n.resolvedLanguage}
                data={rows}
                columns={columns.columns([
                  columns.column("name", {
                    header: t("admin:users.table.name"),
                  }),
                  columns.column("enabled", {
                    header: t("api-key:table.status"),
                    render: (props, { row }) => (
                      <Badge
                        {...props}
                        color={row.original.enabled ? "green" : "gray"}
                      >
                        {t(
                          row.original.enabled
                            ? "admin:system_accounts.enabled"
                            : "admin:system_accounts.disabled",
                        )}
                      </Badge>
                    ),
                  }),
                  columns.column("createdAt", {
                    header: t("api-key:table.created_at"),
                    type: "date",
                  }),
                ])}
                onRowClick={(row) => {
                  if (
                    ability.can(
                      "read",
                      createAbilitySubject("SystemAccount", row.original),
                    )
                  )
                    void navigate({
                      to: "/admin/system-accounts/$systemAccountId",
                      params: { systemAccountId: row.original.id },
                    });
                }}
                pagination={{
                  hasPreviousPage:
                    data?.systemAccounts.pageInfo.hasPreviousPage,
                  hasNextPage: data?.systemAccounts.pageInfo.hasNextPage,
                  onPreviousPage: () =>
                    navigate({
                      to: "/admin/system-accounts",
                      search: getPreviousSearch(
                        search,
                        data?.systemAccounts.pageInfo,
                      ),
                    }),
                  onNextPage: () =>
                    navigate({
                      to: "/admin/system-accounts",
                      search: getNextSearch(
                        search,
                        data?.systemAccounts.pageInfo,
                      ),
                    }),
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
