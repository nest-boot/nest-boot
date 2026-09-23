import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useTranslation } from "react-i18next";
import { useAbility } from "@/contexts/ability-context";
import { usePageSearch } from "@/hooks/use-page-search";

import { ApiKeysPage } from "@/components/api-keys-page";
import {
  DELETE_API_KEY_FROM_API_KEYS_ROUTE,
  GET_API_KEYS_FROM_API_KEYS_ROUTE,
  UPDATE_API_KEY_FROM_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
import {
  apiKeySearchSchema,
  createApiKeyQueryVariables,
  getWorkspaceApiKeysPageKey,
} from "@/lib/api-key-search";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/",
)({
  component: ScopedApiKeysComponent,
  validateSearch: zodValidator(apiKeySearchSchema),
});

function ScopedApiKeysComponent() {
  const { workspaceId } = Route.useParams();
  return <ApiKeysComponent key={workspaceId} />;
}

function ApiKeysComponent() {
  const { workspaceId } = Route.useParams();
  const { t } = useTranslation();
  const ability = useAbility();
  const search = Route.useSearch();
  usePageSearch(getWorkspaceApiKeysPageKey(workspaceId), {
    searchSchema: apiKeySearchSchema,
    search,
  });
  const { data, refetch } = useQuery(GET_API_KEYS_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "network-only",
    variables: createApiKeyQueryVariables(search),
  });
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
      createPath={`/workspaces/${workspaceId}/api-keys/create`}
      detailPath={(id) => `/workspaces/${workspaceId}/api-keys/${id}`}
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
