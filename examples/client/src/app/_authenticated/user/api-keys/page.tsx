import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { t } from "i18next";
import { useCurrentUserAbility } from "../../contexts/current-user-context";
import { ApiKeysPage } from "@/components/api-keys-page";
import { graphql } from "@/gql";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
} from "@/lib/api-key-search";
import {
  authPermissionOptions,
  authPermissionValues,
  workspacePermissionValues,
} from "@/lib/permissions";

const GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE = graphql(`
  query getUserApiKeysFromUserApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: ApiKeyFilter
    $orderBy: ApiKeyOrder
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

const CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {
    createUserApiKey(input: $input) {
      apiKey
      entity {
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
  }
`);

const UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation updateUserApiKeyFromUserApiKeysRoute(
    $id: ID!
    $input: UpdateApiKeyInput!
  ) {
    updateUserApiKey(id: $id, input: $input) {
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

export const Route = createFileRoute("/_authenticated/user/api-keys/")({
  component: ApiKeysComponent,
  beforeLoad: ({ context }) => {
    if (!context.currentUserAbility.can("read", "ApiKey")) {
      throw redirect({ to: "/user" });
    }
  },
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ApiKeysComponent() {
  const ability = useCurrentUserAbility();
  const search = Route.useSearch();
  const { data, refetch } = useQuery(
    GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE,
    {
      variables: createApiKeyQueryVariables(search),
    },
  );
  const [createApiKey, { loading: createLoading }] = useMutation(
    CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const [updateApiKey, { loading: updateLoading }] = useMutation(
    UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const [deleteApiKey, { loading: deleteLoading }] = useMutation(
    DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const connection = data?.currentUser.apiKeys;

  return (
    <ApiKeysPage
      ability={ability}
      title={t("api-key:user.title")}
      description={t("api-key:user.description")}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
      permissionValues={authPermissionValues}
      permissionOptions={authPermissionOptions}
      defaultPermissions={workspacePermissionValues.filter(
        (permission) => !permission.startsWith("api-key:"),
      )}
      createLoading={createLoading}
      updateLoading={updateLoading}
      deleteLoading={deleteLoading}
      createApiKey={async (input) => {
        const result = await createApiKey({ variables: { input } });
        return result.data?.createUserApiKey.apiKey;
      }}
      updateApiKey={(id, input) => updateApiKey({ variables: { id, input } })}
      deleteApiKey={(id) => deleteApiKey({ variables: { id } })}
      refetch={refetch}
    />
  );
}
