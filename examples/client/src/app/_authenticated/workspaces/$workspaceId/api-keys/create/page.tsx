import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { usePageSearch } from "@/hooks/use-page-search";
import {
  apiKeySearchSchema,
  getWorkspaceApiKeysPageKey,
} from "@/lib/api-key-search";
import {
  CREATE_API_KEY_FROM_API_KEYS_ROUTE,
  GET_WORKSPACE_API_KEY_OPTIONS,
} from "@/lib/api-key-operations";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/create/",
)({
  component: CreateApiKeyPage,
  beforeLoad: async ({ context, params }) => {
    const denied = () =>
      redirect({
        to: "/workspaces/$workspaceId/api-keys",
        params: { workspaceId: params.workspaceId },
      });
    if (!context.ability.can("write", "WorkspaceApiKey")) throw denied();
    const { data } = await context.apolloClient
      .query({
        query: GET_WORKSPACE_API_KEY_OPTIONS,
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    return {
      permissionOptions: data?.workspaceApiKeyPermissions ?? [],
      title: t("api-key:create.title"),
    };
  },
});

function CreateApiKeyPage() {
  const { workspaceId } = Route.useParams();
  const { pageSearch } = usePageSearch({
    key: getWorkspaceApiKeysPageKey(workspaceId),
    searchSchema: apiKeySearchSchema,
  });
  const { permissionOptions } = Route.useRouteContext();
  const [createApiKey] = useMutation(CREATE_API_KEY_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "no-cache",
  });
  return (
    <ApiKeyFormPage
      key={workspaceId}
      canWrite
      listPath={`/workspaces/${workspaceId}/api-keys`}
      listSearch={pageSearch}
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      defaultPermissions={getDefaultApiKeyPermissions(permissionOptions)}
      onSave={async (input) => {
        const result = await createApiKey({ variables: { input } });
        return result.data?.createWorkspaceApiKey.apiKey;
      }}
    />
  );
}
