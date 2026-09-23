import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { ApiKeyNavigation } from "@/components/api-key-navigation";
import { useAbility } from "@/contexts/ability-context";
import { usePageNavigation } from "@/hooks/use-page-navigation";
import { createAbilitySubject } from "@/lib/ability";
import {
  GET_USER_API_KEY,
  GET_USER_API_KEY_NEIGHBORS,
  UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import {
  apiKeySearchSchema,
  createApiKeyCursor,
  createApiKeyQueryVariables,
  userApiKeysPageKey,
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
  const navigation = usePageNavigation(userApiKeysPageKey, {
    searchSchema: apiKeySearchSchema,
    record: apiKey,
    getCursor: createApiKeyCursor,
  });
  const { query, filter, orderBy } = createApiKeyQueryVariables(
    navigation.search,
  );
  const { data, loading, error, refetch } = useQuery(
    GET_USER_API_KEY_NEIGHBORS,
    {
      variables: {
        query,
        filter,
        orderBy,
        before: navigation.previousSearch.before,
        after: navigation.nextSearch.after,
      },
      fetchPolicy: "network-only",
    },
  );
  const neighbors = !loading && !error ? data?.currentUser : undefined;
  const previous = neighbors?.previous.edges[0];
  const next = neighbors?.next.edges[0];
  const listSearch = navigation.getReturnSearch(
    neighbors ? (previous?.cursor ?? null) : undefined,
  );
  return (
    <ApiKeyFormPage
      key={apiKey.id}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("UserApiKey", apiKey),
      )}
      listPath={"/user/api-keys"}
      listSearch={listSearch}
      navigation={
        <ApiKeyNavigation
          previousPath={
            previous ? `/user/api-keys/${previous.node.id}` : undefined
          }
          nextPath={next ? `/user/api-keys/${next.node.id}` : undefined}
          failed={Boolean(error)}
          onRetry={() => {
            void refetch().catch(() => undefined);
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
