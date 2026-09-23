import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { useAbility } from "@/contexts/ability-context";

import { ApiKeysPage } from "@/components/api-keys-page";
import { graphql } from "@/gql";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
} from "@/lib/api-key-search";
import {
  authPermissionValues,
  getDefaultApiKeyPermissions,
  getPermissionOptions,
} from "@/lib/permissions";

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
    userApiKeyPermissions {
      permission
      grantable
      default
    }
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
  mutation createUserApiKeyFromUserApiKeysRoute(
    $input: CreateUserApiKeyInput!
  ) {
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
    $input: UpdateUserApiKeyInput!
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
    if (!context.ability.can("read", "UserApiKey")) {
      throw redirect({ to: "/user" });
    }
  },
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ApiKeysComponent() {
  const { t } = useTranslation();
  const ability = useAbility();
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
      subject="UserApiKey"
      ability={ability}
      title={t("api-key:user.title")}
      description={t("api-key:user.description")}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
      permissionValues={authPermissionValues}
      permissionOptions={getPermissionOptions(
        data?.userApiKeyPermissions ?? [],
      )}
      defaultPermissions={getDefaultApiKeyPermissions(
        data?.userApiKeyPermissions ?? [],
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
