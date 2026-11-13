import { useLazyQuery, useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";
import { useCallback } from "react";

import type { ResourceNavigationQueryOptions } from "@/hooks/use-resource-navigation";
import { REVOKE_WORKSPACE_API_KEY } from "@/graphql/mutations/revoke-workspace-api-key";
import { getApiKeyUpdateInput } from "@/lib/api-key-update";
import { graphql } from "@/gql";
import { UPDATE_WORKSPACE_API_KEY } from "@/graphql/mutations/update-workspace-api-key";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { Link } from "@/components/link";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { createAbilitySubject } from "@/lib/ability";
import { createConnectionCursor } from "@/lib/graphql-connection";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { getWorkspaceApiKeysResourceKey } from "@/lib/resource-keys";
import {
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

const DELETE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation deleteWorkspaceApiKey($id: ID!) {
    deleteWorkspaceApiKey(id: $id) {
      id
      name
      start
      prefix
      revokedAt
      permissions
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);

const GET_WORKSPACE_API_KEY = graphql(`
  query getWorkspaceApiKeyDetails($id: ID!) {
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
    currentWorkspace {
      apiKey(id: $id) {
        member {
          __typename

          id
          name
        }
        id
        name
        start
        prefix
        revokedAt
        permissions
        createdAt
        lastUsedAt
        expiresAt
      }
    }
  }
`);

const GET_WORKSPACE_API_KEY_NEIGHBORS = graphql(`
  query getWorkspaceApiKeyNeighbors(
    $cursor: String!
    $filter: WorkspaceApiKeyFilter
    $orderBy: WorkspaceApiKeyOrder
    $query: String
  ) {
    currentWorkspace {
      id
    }
    previous: workspaceApiKeys(
      last: 1
      before: $cursor
      filter: $filter
      orderBy: $orderBy
      query: $query
    ) {
      edges {
        cursor
        node {
          id
        }
      }
    }
    next: workspaceApiKeys(
      first: 1
      after: $cursor
      filter: $filter
      orderBy: $orderBy
      query: $query
    ) {
      edges {
        cursor
        node {
          id
        }
      }
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/$apiKeyId/",
)({
  component: ApiKeyDetailsPage,
  beforeLoad: async ({ context, params }) => {
    const denied = () =>
      redirect({
        to: "/workspaces/$workspaceId/api-keys",
        params: { workspaceId: params.workspaceId },
      });
    const { data } = await context.apolloClient
      .query({
        query: GET_WORKSPACE_API_KEY,
        variables: { id: params.apiKeyId },
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const metadata = data?.currentWorkspace?.apiKey;
    const apiKey = metadata
      ? { ...metadata, workspaceId: params.workspaceId }
      : undefined;
    if (
      !apiKey ||
      !data ||
      !context.ability.can(
        "read",
        createAbilitySubject("WorkspaceApiKey", apiKey),
      )
    )
      throw denied();
    return {
      apiKey,
      permissionOptions: data.workspaceApiKeyPermissions,
      title: t("api-key:edit.title"),
    };
  },
});

function ApiKeyDetailsPage() {
  const { secret } = useCreatedApiKey();
  const { workspaceId } = Route.useParams();
  const { apiKey, permissionOptions } = Route.useRouteContext();
  const ability = useAbility();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [deleteApiKey] = useMutation(DELETE_API_KEY_FROM_API_KEYS_ROUTE);
  const [revoke] = useMutation(REVOKE_WORKSPACE_API_KEY);
  const [updateApiKey] = useMutation(UPDATE_WORKSPACE_API_KEY);
  const [loadNeighbors] = useLazyQuery(GET_WORKSPACE_API_KEY_NEIGHBORS, {
    fetchPolicy: "no-cache",
  });
  const currentUser = useCurrentUserContext();
  const query = useCallback(
    async ({
      search,
    }: ResourceNavigationQueryOptions<typeof apiKeySearchSchema>) => {
      const { query, filter, orderBy } = search;
      const cursor = createConnectionCursor(apiKey, search);
      const { data } = await loadNeighbors({
        variables: {
          query,
          filter,
          orderBy,
          cursor,
        },
        context: {
          headers: { "x-workspace-id": workspaceId },
          queryDeduplication: false,
        },
      });
      if (data?.currentWorkspace?.id !== workspaceId) return undefined;
      return {
        previousEdge: data.previous.edges[0],
        nextEdge: data.next.edges[0],
      };
    },
    [apiKey, loadNeighbors, workspaceId],
  );
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
    // Keep the saved return position while revealing a newly created key.
    query: secret ? undefined : query,
  });
  const { previousEdge, nextEdge, backSearch } = navigation;
  const listPath = `/workspaces/${workspaceId}/api-keys`;
  return (
    <ApiKeyFormPage
      key={`Workspace-${workspaceId}-${apiKey.id}`}
      apiKey={apiKey}
      ownerName={
        apiKey.member?.__typename === "WorkspaceMember"
          ? apiKey.member.name
          : undefined
      }
      canWrite={ability.can(
        "write",
        createAbilitySubject("WorkspaceApiKey", apiKey),
      )}
      listPath={listPath}
      listSearch={backSearch}
      paginationActions={{
        previous: {
          disabled: !previousEdge,
          render: previousEdge ? (
            <Link to={listPath + "/" + previousEdge.node.id} />
          ) : undefined,
        },
        next: {
          disabled: !nextEdge,
          render: nextEdge ? (
            <Link to={listPath + "/" + nextEdge.node.id} />
          ) : undefined,
        },
      }}
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      canRevoke={ability.can(
        "write",
        createAbilitySubject("WorkspaceApiKey", apiKey),
        "revokedAt",
      )}
      onRevoke={async () => {
        await revoke({ variables: { id: apiKey.id } });
        await router.invalidate();
      }}
      onDelete={async () => {
        await deleteApiKey({ variables: { id: apiKey.id } });
        await navigate({
          to: "/workspaces/$workspaceId/api-keys",
          params: { workspaceId },
          search: backSearch,
        });
      }}
      onSave={async (input) => {
        await updateApiKey({
          variables: {
            id: apiKey.id,
            input: getApiKeyUpdateInput(apiKey, input),
          },
        });
        await router.invalidate();
        return undefined;
      }}
    />
  );
}
