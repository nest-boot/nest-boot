import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { graphql } from "@/gql";
import { UPDATE_WORKSPACE_API_KEY } from "@/graphql/mutations/update-workspace-api-key";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { ApiKeysPage } from "@/components/api-keys-page";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { getWorkspaceApiKeysResourceKey } from "@/lib/resource-keys";

const DELETE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {
    deleteWorkspaceApiKey(id: $id) {
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
`);

const GET_API_KEYS_FROM_API_KEYS_ROUTE = graphql(`
  query getApiKeysFromApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: WorkspaceApiKeyFilter
    $orderBy: WorkspaceApiKeyOrder
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
    key: [currentUser.id, ...getWorkspaceApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, refetch } = useQuery(GET_API_KEYS_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "network-only",
    variables: search,
  });
  const [updateApiKey, { loading: updateLoading }] = useMutation(
    UPDATE_WORKSPACE_API_KEY,
  );
  const [deleteApiKey, { loading: deleteLoading }] = useMutation(
    DELETE_API_KEY_FROM_API_KEYS_ROUTE,
  );
  const connection = data?.currentWorkspace?.apiKeys;

  return (
    <ApiKeysPage
      subject="WorkspaceApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("api-key:description")}
      createPath={`/workspaces/${workspaceId}/api-keys/create`}
      detailPath={(id) => `/workspaces/${workspaceId}/api-keys/${id}`}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
      updateLoading={updateLoading}
      deleteLoading={deleteLoading}
      updateApiKey={(id, input) => updateApiKey({ variables: { id, input } })}
      deleteApiKey={(id) => deleteApiKey({ variables: { id } })}
      refetch={refetch}
    />
  );
}
