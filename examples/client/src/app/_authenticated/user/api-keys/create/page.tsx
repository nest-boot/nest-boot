import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { graphql } from "@/gql";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search";
import { userApiKeysResourceKey } from "@/lib/resource-keys";
import {
  authPermissionValues,
  getDefaultApiKeyPermissions,
  getPermissionOptions,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

const CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation createUserApiKeyFromUserApiKeysRoute(
    $input: CreateUserApiKeyInput!
  ) {
    createUserApiKey(input: $input) {
      apiKey
      entity {
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

const GET_USER_API_KEY_OPTIONS = graphql(`
  query getUserApiKeyOptions {
    userApiKeyPermissions {
      permission
      grantable
      default
    }
  }
`);

export const Route = createFileRoute("/_authenticated/user/api-keys/create/")({
  component: CreateApiKeyPage,
  beforeLoad: async ({ context }) => {
    const denied = () => redirect({ to: "/user/api-keys" });
    if (!context.ability.can("write", "UserApiKey")) throw denied();
    const { data } = await context.apolloClient
      .query({
        query: GET_USER_API_KEY_OPTIONS,
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    return {
      permissionOptions: data?.userApiKeyPermissions ?? [],
      title: t("api-key:create.title"),
    };
  },
});

function CreateApiKeyPage() {
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...userApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
  });
  const { permissionOptions } = Route.useRouteContext();
  const [createApiKey] = useMutation(
    CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
    { fetchPolicy: "no-cache" },
  );
  return (
    <ApiKeyFormPage
      canWrite
      listPath={"/user/api-keys"}
      listSearch={backSearch}
      permissionValues={authPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      defaultPermissions={getDefaultApiKeyPermissions(permissionOptions)}
      onSave={async (input) => {
        const result = await createApiKey({ variables: { input } });
        return result.data?.createUserApiKey.apiKey;
      }}
    />
  );
}
