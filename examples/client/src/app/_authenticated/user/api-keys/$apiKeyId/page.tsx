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
  GET_USER_API_KEY,
  GET_USER_API_KEY_NEIGHBORS,
  UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
  userApiKeysResourceKey,
} from "@/lib/api-key-search";
import { authPermissionValues, getPermissionOptions } from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

export const Route = createFileRoute(
  "/_authenticated/user/api-keys/$apiKeyId/",
)({
  component: ApiKeyDetailsPage,
  beforeLoad: async ({ context, params }) => {
    const denied = () => redirect({ to: "/user/api-keys" });
    const { data } = await context.apolloClient
      .query({
        query: GET_USER_API_KEY,
        variables: { id: params.apiKeyId },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const apiKey = data?.currentUser?.apiKey;
    if (
      !apiKey ||
      !context.ability.can("read", createAbilitySubject("UserApiKey", apiKey))
    )
      throw denied();
    return {
      apiKey,
      permissionOptions: data.userApiKeyPermissions,
      title: t("api-key:edit.title"),
    };
  },
});

function ApiKeyDetailsPage() {
  const { apiKey, permissionOptions } = Route.useRouteContext();
  const ability = useAbility();
  const router = useRouter();
  const [updateApiKey] = useMutation(
    UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const [loadNeighbors] = useLazyQuery(GET_USER_API_KEY_NEIGHBORS, {
    fetchPolicy: "network-only",
  });
  const currentUser = useCurrentUserContext();
  const navigation = useResourceNavigation({
    key: [currentUser.id, ...userApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
    query: useCallback(
      async ({
        search,
      }: ResourceNavigationQueryOptions<typeof apiKeySearchSchema>) => {
        const { query, filter, orderBy } = createApiKeyQueryVariables(search);
        const cursor = createConnectionCursor(apiKey, search);
        const { data } = await loadNeighbors({
          variables: {
            query,
            filter,
            orderBy,
            cursor,
          },
        });
        if (!data?.currentUser) return undefined;
        return {
          previousEdge: data.currentUser.previous.edges[0],
          nextEdge: data.currentUser.next.edges[0],
        };
      },
      [apiKey, loadNeighbors],
    ),
  });
  const { previousEdge, nextEdge, backSearch, error } = navigation;
  return (
    <ApiKeyFormPage
      key={apiKey.id}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("UserApiKey", apiKey),
      )}
      listPath={"/user/api-keys"}
      listSearch={backSearch}
      navigation={
        <ApiKeyNavigation
          previousPath={
            previousEdge ? `/user/api-keys/${previousEdge.node.id}` : undefined
          }
          nextPath={nextEdge ? `/user/api-keys/${nextEdge.node.id}` : undefined}
          failed={Boolean(error)}
          onRetry={() => {
            void navigation.refetch().catch(() => undefined);
          }}
        />
      }
      permissionValues={authPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      onSave={async (input) => {
        await updateApiKey({ variables: { id: apiKey.id, input } });
        await router.invalidate();
        return undefined;
      }}
    />
  );
}
