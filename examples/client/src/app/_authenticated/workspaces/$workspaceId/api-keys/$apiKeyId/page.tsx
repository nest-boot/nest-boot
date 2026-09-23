import { useLazyQuery, useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";
import { useCallback } from "react";

import type { PageNavigationQueryOptions } from "@/hooks/use-page-navigation";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { ApiKeyNavigation } from "@/components/api-key-navigation";
import { useAbility } from "@/contexts/ability-context";
import { usePageNavigation } from "@/hooks/use-page-navigation";
import { createAbilitySubject } from "@/lib/ability";
import {
  GET_WORKSPACE_API_KEY,
  GET_WORKSPACE_API_KEY_NEIGHBORS,
  UPDATE_API_KEY_FROM_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
  getWorkspaceApiKeysPageKey,
} from "@/lib/api-key-search";
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
  const navigation = usePageNavigation({
    key: getWorkspaceApiKeysPageKey(workspaceId),
    searchSchema: apiKeySearchSchema,
    record: apiKey,
    query: useCallback(
      async ({
        pageSearch,
        cursor,
      }: PageNavigationQueryOptions<typeof apiKeySearchSchema>) => {
        const { query, filter, orderBy } =
          createApiKeyQueryVariables(pageSearch);
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor,
          },
          context: { headers: { "x-workspace-id": workspaceId } },
        });
        return data?.currentWorkspace?.id === workspaceId
          ? data.currentWorkspace
          : undefined;
      },
      [loadNeighbors, workspaceId],
    ),
  });
  const { previous, next, backSearch, error } = navigation;
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
            previous ? `${listPath}/${previous.node.id}` : undefined
          }
          nextPath={next ? `${listPath}/${next.node.id}` : undefined}
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
