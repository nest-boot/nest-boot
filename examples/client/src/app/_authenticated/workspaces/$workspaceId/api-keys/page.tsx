import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { graphql } from "@/gql";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { ApiKeysPage } from "@/components/api-keys-page";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { getMemberApiKeysResourceKey } from "@/lib/resource-keys";

const GET_API_KEYS_FROM_API_KEYS_ROUTE = graphql(`
  query getApiKeysFromApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: MemberApiKeyFilter
    $orderBy: MemberApiKeyOrder
    $query: String
  ) {
    currentWorkspace {
      apiKeys(
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
            name
            start
            prefix
            enabled
            permissions
            createdAt
            lastUsedAt
            expiresAt
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
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/",
)({
  component: ScopedApiKeysComponent,
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ScopedApiKeysComponent() {
  const { workspaceId } = Route.useParams();
  return <ApiKeysComponent key={workspaceId} />;
}

function ApiKeysComponent() {
  const { workspaceId } = Route.useParams();
  const { t } = useTranslation();
  const ability = useAbility();
  const search = Route.useSearch();
  const currentUser = useCurrentUserContext();
  useResourceNavigation({
    key: [currentUser.id, ...getMemberApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data } = useQuery(GET_API_KEYS_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "network-only",
    variables: search,
  });
  const connection = data?.currentWorkspace?.apiKeys;

  return (
    <ApiKeysPage
      subject="MemberApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("api-key:description")}
      createPath={`/workspaces/${workspaceId}/api-keys/create`}
      detailPath={(id) => `/workspaces/${workspaceId}/api-keys/${id}`}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
    />
  );
}
