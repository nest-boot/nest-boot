import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useAbility } from "@/contexts/ability-context";
import { createAbilitySubject } from "@/lib/ability";
import {
  GET_WORKSPACE_API_KEY,
  UPDATE_API_KEY_FROM_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
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
  return (
    <ApiKeyFormPage
      key={`Workspace-${workspaceId}-${apiKey.id}`}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("WorkspaceApiKey", apiKey),
      )}
      listPath={`/workspaces/${workspaceId}/api-keys`}
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
