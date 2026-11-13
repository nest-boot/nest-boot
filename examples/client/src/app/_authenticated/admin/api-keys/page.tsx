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
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";

const LIST = graphql(`
  query systemApiKeys(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $query: String
    $filter: SystemApiKeyFilter
    $orderBy: SystemApiKeyOrder
  ) {
    systemApiKeys(
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
          systemAccount {
            __typename

            id
            name
          }
          revokedAt
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
  const user = useAuthUserContext();
  useResourceNavigation({
    key: [user.id, ...adminApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, error, refetch } = useQuery(LIST, {
    variables: search,
    fetchPolicy: "network-only",
  });
  const connection = data?.systemApiKeys;
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
      showOwner
      ownerPath={(owner) =>
        owner.__typename === "SystemAccount" &&
        ability.can("read", "SystemAccount")
          ? `/admin/system-accounts/${owner.id}`
          : undefined
      }
      canCreate={
        ability.can("write", "SystemApiKey") &&
        (ability.can("read", "SystemAccount") ||
          ability.can("write", "SystemAccount"))
      }
      subject="SystemApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("admin:system_accounts.keys_description")}
      search={search}
      apiKeys={
        connection?.edges.map(({ node }) => ({
          ...node,
          owner:
            node.systemAccount?.__typename === "SystemAccount"
              ? node.systemAccount
              : null,
        })) ?? []
      }
      pageInfo={connection?.pageInfo}
      createPath="/admin/api-keys/create"
      detailPath={(id) => `/admin/api-keys/${id}`}
    />
  );
}
