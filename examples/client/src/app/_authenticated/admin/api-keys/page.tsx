import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { adminApiKeysResourceKey } from "@/lib/resource-keys";
import { ApiKeysPage } from "@/components/api-keys-page";
import { OverviewError } from "@/components/overview-card";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

const LIST = graphql(`
  query managedSystemAccountKeys(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $query: String
    $filter: SystemAccountApiKeyFilter
    $orderBy: SystemAccountApiKeyOrder
  ) {
    systemAccountApiKeys(
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
          systemAccountId
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
`);
export const Route = createFileRoute("/_authenticated/admin/api-keys/")({
  component: Keys,
  validateSearch: zodValidator(apiKeySearchSchema),
});
function Keys() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const ability = useAbility();
  const user = useCurrentUserContext();
  useResourceNavigation({
    key: [user.id, ...adminApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, error, refetch } = useQuery(LIST, {
    variables: search,
    fetchPolicy: "network-only",
  });
  const connection = data?.systemAccountApiKeys;
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
      canCreate={
        ability.can("write", "SystemAccountApiKey") &&
        (ability.can("read", "SystemAccount") ||
          ability.can("write", "SystemAccount"))
      }
      subject="SystemAccountApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("admin:system_accounts.keys_description")}
      search={search}
      apiKeys={connection?.edges.map(({ node }) => node) ?? []}
      pageInfo={connection?.pageInfo}
      createPath="/admin/api-keys/create"
      detailPath={(id) => `/admin/api-keys/${id}`}
    />
  );
}
