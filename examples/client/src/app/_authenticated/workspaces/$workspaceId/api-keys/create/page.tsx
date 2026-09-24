import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { graphql } from "@/gql";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search";
import { getWorkspaceApiKeysResourceKey } from "@/lib/resource-keys";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

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

const GET_WORKSPACE_API_KEY_OPTIONS = graphql(`
  query getWorkspaceApiKeyOptions {
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
  }
`);

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
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceApiKeysResourceKey(workspaceId)],
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
      listSearch={backSearch}
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
