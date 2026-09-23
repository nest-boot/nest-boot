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
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";

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
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
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

const CREATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation createWorkspaceApiKeyFromApiKeysRoute(
    $input: CreateWorkspaceApiKeyInput!
  ) {
    createWorkspaceApiKey(input: $input) {
      apiKey
      entity {
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
  }
`);

const UPDATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation updateWorkspaceApiKeyFromApiKeysRoute(
    $id: ID!
    $input: UpdateWorkspaceApiKeyInput!
  ) {
    updateWorkspaceApiKey(id: $id, input: $input) {
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

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/",
)({
  component: ScopedApiKeysComponent,
  beforeLoad: ({ context, params }) => {
    if (!context.ability.can("read", "WorkspaceApiKey")) {
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
  const { t } = useTranslation();
  const ability = useAbility();
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
      subject="WorkspaceApiKey"
      ability={ability}
      title={t("api-key:title")}
      description={t("api-key:description")}
      search={search}
      apiKeys={connection?.edges.map((edge) => edge.node) ?? []}
      pageInfo={connection?.pageInfo}
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(
        data?.workspaceApiKeyPermissions ?? [],
      )}
      defaultPermissions={getDefaultApiKeyPermissions(
        data?.workspaceApiKeyPermissions ?? [],
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
