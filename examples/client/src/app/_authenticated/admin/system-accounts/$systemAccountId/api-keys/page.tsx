import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { Link } from "@/components/link";
import { ApiKeysPage } from "@/components/api-keys-page";
import { OverviewError } from "@/components/overview-card";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

const LIST = graphql(`
  query managedSystemAccountKeys(
    $id: ID!
    $first: Int
    $last: Int
    $after: String
    $before: String
    $query: String
    $filter: SystemAccountApiKeyFilter
    $orderBy: SystemAccountApiKeyOrder
  ) {
    systemAccount(id: $id) {
      id
      apiKeys(
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
            prefix
            start
            createdAt
            lastUsedAt
            expiresAt
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`);
export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/$systemAccountId/api-keys/",
)({ component: Keys, validateSearch: zodValidator(apiKeySearchSchema) });
function Keys() {
  const { t } = useTranslation();
  const { account } = Route.useRouteContext();
  const search = Route.useSearch();
  const ability = useAbility();
  const user = useCurrentUserContext();
  useResourceNavigation({
    key: [user.id, "admin", "system-accounts", account.id, "api-keys"],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, error, refetch } = useQuery(LIST, {
    variables: { ...search, id: account.id },
    fetchPolicy: "network-only",
  });
  const connection = data?.systemAccount?.apiKeys;
  if (error)
    return (
      <OverviewError
        onRetry={() => {
          void refetch().catch(() => undefined);
        }}
      />
    );
  return (
    <ApiKeysPage
      breadcrumbActions={[
        {
          label: account.name,
          render: (
            <Link
              to="/admin/system-accounts/$systemAccountId"
              params={{ systemAccountId: account.id }}
            />
          ),
        },
      ]}
      canCreate={account.enabled && ability.can("write", "SystemAccountApiKey")}
      subject="SystemAccountApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("admin:system_accounts.keys_description", {
        name: account.name,
      })}
      search={search}
      apiKeys={connection?.edges.map(({ node }) => node) ?? []}
      pageInfo={connection?.pageInfo}
      createPath={`/admin/system-accounts/${account.id}/api-keys/create`}
      detailPath={(id) => `/admin/system-accounts/${account.id}/api-keys/${id}`}
    />
  );
}
