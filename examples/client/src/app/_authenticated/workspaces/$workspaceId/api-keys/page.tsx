import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { t } from "i18next";
import { useCurrentWorkspaceAbility } from "../contexts/current-member-context";
import { ApiKeysPage } from "@/components/api-keys-page";
import { graphql } from "@/gql";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
} from "@/lib/api-key-search";
import {
  workspaceApiKeyPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";

const GET_API_KEYS_FROM_API_KEYS_ROUTE = graphql(`
  query getApiKeysFromApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: ApiKeyFilter
    $orderBy: ApiKeyOrder
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

const CREATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation createWorkspaceApiKeyFromApiKeysRoute($input: CreateApiKeyInput!) {
    createWorkspaceApiKey(input: $input) {
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

const UPDATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation updateWorkspaceApiKeyFromApiKeysRoute(
    $id: ID!
    $input: UpdateApiKeyInput!
  ) {
    updateWorkspaceApiKey(id: $id, input: $input) {
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

const DELETE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation deleteWorkspaceApiKeyFromApiKeysRoute($id: ID!) {
    deleteWorkspaceApiKey(id: $id) {
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

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/",
)({
  component: ScopedApiKeysComponent,
  beforeLoad: ({ context, params }) => {
    if (!context.currentWorkspaceAbility.can("read", "ApiKey")) {
      throw redirect({
        to: "/workspaces/$workspaceId",
        params: { workspaceId: params.workspaceId },
      });
    }
  },
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ScopedApiKeysComponent() {
  const { workspaceId } = Route.useParams();
  return <ApiKeysComponent key={workspaceId} />;
}

function ApiKeysComponent() {
  const ability = useCurrentWorkspaceAbility();
  const search = Route.useSearch();
  const { data, refetch } = useQuery(GET_API_KEYS_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "network-only",
    variables: createApiKeyQueryVariables(search),
  });
  const [createApiKey, { loading: createLoading }] = useMutation(
    CREATE_API_KEY_FROM_API_KEYS_ROUTE,
  );
  const [updateApiKey, { loading: updateLoading }] = useMutation(
    UPDATE_API_KEY_FROM_API_KEYS_ROUTE,
  );
  const [deleteApiKey, { loading: deleteLoading }] = useMutation(
    DELETE_API_KEY_FROM_API_KEYS_ROUTE,
  );
  const connection = data?.currentWorkspace?.apiKeys;

  return (
    <ApiKeysPage
      ability={ability}
      title={t("api-key:title")}
      description={t("api-key:description")}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={workspaceApiKeyPermissionOptions}
      defaultPermissions={workspaceApiKeyPermissionValues.filter(
        (permission) => !permission.startsWith("api-key:"),
      )}
      createLoading={createLoading}
      updateLoading={updateLoading}
      deleteLoading={deleteLoading}
      createApiKey={async (input) => {
        const result = await createApiKey({ variables: { input } });
        return result.data?.createWorkspaceApiKey.apiKey;
      }}
      updateApiKey={(id, input) => updateApiKey({ variables: { id, input } })}
      deleteApiKey={(id) => deleteApiKey({ variables: { id } })}
      refetch={refetch}
    />
  );
}
