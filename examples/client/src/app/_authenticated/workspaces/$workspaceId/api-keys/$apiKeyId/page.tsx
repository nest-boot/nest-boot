import { useLazyQuery, useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";
import { useCallback } from "react";

import type { ResourceNavigationQueryOptions } from "@/hooks/use-resource-navigation";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { ApiKeyNavigation } from "@/components/api-key-navigation";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { createAbilitySubject } from "@/lib/ability";
import { createConnectionCursor } from "@/lib/connection-cursor";
import {
  GET_WORKSPACE_API_KEY,
  GET_WORKSPACE_API_KEY_NEIGHBORS,
  UPDATE_API_KEY_FROM_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import { apiKeySearchSchema } from "@/schemas/api-key-search";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { getWorkspaceApiKeysResourceKey } from "@/lib/resource-keys";
import {
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

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
    const apiKey = data?.currentWorkspace?.apiKey;
    if (
      !apiKey ||
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
  const { workspaceId } = Route.useParams();
  const { apiKey, permissionOptions } = Route.useRouteContext();
  const ability = useAbility();
  const router = useRouter();
  const [updateApiKey] = useMutation(UPDATE_API_KEY_FROM_API_KEYS_ROUTE);
  const [loadNeighbors] = useLazyQuery(GET_WORKSPACE_API_KEY_NEIGHBORS, {
    fetchPolicy: "network-only",
  });
  const currentUser = useCurrentUserContext();
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
    query: useCallback(
      async ({
        search,
      }: ResourceNavigationQueryOptions<typeof apiKeySearchSchema>) => {
        const { query, filter, orderBy } =
          createConnectionQueryVariables(search);
        const cursor = createConnectionCursor(apiKey, search);
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor,
          },
          context: { headers: { "x-workspace-id": workspaceId } },
        });
        if (data?.currentWorkspace?.id !== workspaceId) return undefined;
        return {
          previousEdge: data.currentWorkspace.previous.edges[0],
          nextEdge: data.currentWorkspace.next.edges[0],
        };
      },
      [apiKey, loadNeighbors, workspaceId],
    ),
  });
  const { previousEdge, nextEdge, backSearch, error } = navigation;
  const listPath = `/workspaces/${workspaceId}/api-keys`;
  return (
    <ApiKeyFormPage
      key={`Workspace-${workspaceId}-${apiKey.id}`}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("WorkspaceApiKey", apiKey),
      )}
      listPath={listPath}
      listSearch={backSearch}
      navigation={
        <ApiKeyNavigation
          previousPath={
            previousEdge ? `${listPath}/${previousEdge.node.id}` : undefined
          }
          nextPath={nextEdge ? `${listPath}/${nextEdge.node.id}` : undefined}
          failed={Boolean(error)}
          onRetry={() => {
            void navigation.refetch().catch(() => undefined);
          }}
        />
      }
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      onSave={async (input) => {
        await updateApiKey({ variables: { id: apiKey.id, input } });
        await router.invalidate();
        return undefined;
      }}
    />
  );
}
