import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";

import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useAbility } from "@/contexts/ability-context";
import { createAbilitySubject } from "@/lib/ability";
import {
  GET_USER_API_KEY,
  UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
} from "@/lib/api-key-operations";
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
  return (
    <ApiKeyFormPage
      key={apiKey.id}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("UserApiKey", apiKey),
      )}
      listPath={"/user/api-keys"}
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
