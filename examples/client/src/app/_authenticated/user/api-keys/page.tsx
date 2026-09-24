import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useAbility } from "@/contexts/ability-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { ApiKeysPage } from "@/components/api-keys-page";
import {
  DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE,
  UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
  userApiKeysResourceKey,
} from "@/lib/api-key-search";

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
      variables: createApiKeyQueryVariables(search),
    },
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
