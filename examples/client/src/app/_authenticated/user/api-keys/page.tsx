import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { graphql } from "@/gql";
import { UPDATE_USER_API_KEY } from "@/graphql/mutations/update-user-api-key";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { ApiKeysPage } from "@/components/api-keys-page";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { userApiKeysResourceKey } from "@/lib/resource-keys";

const DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {
    deleteUserApiKey(id: $id) {
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

const GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE = graphql(`
  query getUserApiKeysFromUserApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: UserApiKeyFilter
    $orderBy: UserApiKeyOrder
    $query: String
  ) {
    currentUser {
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

export const Route = createFileRoute("/_authenticated/user/api-keys/")({
  component: ApiKeysComponent,
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ApiKeysComponent() {
  const { t } = useTranslation();
  const ability = useAbility();
  const search = Route.useSearch();
  const currentUser = useCurrentUserContext();
  useResourceNavigation({
    key: [currentUser.id, ...userApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, refetch } = useQuery(
    GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE,
    {
      fetchPolicy: "network-only",
      variables: createConnectionQueryVariables(search),
    },
  );
  const [updateApiKey, { loading: updateLoading }] =
    useMutation(UPDATE_USER_API_KEY);
  const [deleteApiKey, { loading: deleteLoading }] = useMutation(
    DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const connection = data?.currentUser.apiKeys;

  return (
    <ApiKeysPage
      subject="UserApiKey"
      ability={ability}
      title={t("api-key:user.title")}
      description={t("api-key:user.description")}
      createPath={"/user/api-keys/create"}
      detailPath={(id) => `/user/api-keys/${id}`}
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
