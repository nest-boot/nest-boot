import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { t } from "i18next";
import { adminApiKeysResourceKey } from "@/lib/resource-keys";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { SystemAccountPermission } from "@/gql/graphql";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import {
  DELETE_SYSTEM_KEY,
  SYSTEM_KEY_DETAILS,
  SYSTEM_KEY_PERMISSIONS,
  UPDATE_SYSTEM_KEY,
} from "@/graphql/system-accounts";
import { getPermissionOptions } from "@/lib/permissions";
import { useAbility } from "@/contexts/ability-context";
import { createAbilitySubject } from "@/lib/ability";
import { isAccessDenied } from "@/lib/auth-errors";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

export const Route = createFileRoute(
  "/_authenticated/admin/api-keys/$apiKeyId/",
)({
  component: Details,
  beforeLoad: async ({ context, params }) => {
    const denied = () => redirect({ to: "/admin/api-keys" });
    const { data } = await context.apolloClient
      .query({
        query: SYSTEM_KEY_DETAILS,
        variables: { id: params.apiKeyId },
        fetchPolicy: "network-only",
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const apiKey = data?.systemAccountApiKey;
    if (
      !apiKey ||
      !context.ability.can(
        "read",
        createAbilitySubject("SystemAccountApiKey", apiKey),
      )
    )
      throw denied();
    const choices = await context.apolloClient.query({
      query: SYSTEM_KEY_PERMISSIONS,
      variables: { apiKeyId: apiKey.id },
      fetchPolicy: "network-only",
    });
    return {
      apiKey,
      permissionOptions:
        choices?.data?.systemAccountApiKeyPermissions ??
        context.keyPermissionOptions,
      title: t("api-key:edit.title"),
    };
  },
});
function Details() {
  const { apiKey, permissionOptions } = Route.useRouteContext();
  const ability = useAbility();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const user = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [user.id, ...adminApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
  });
  const [update] = useMutation(UPDATE_SYSTEM_KEY);
  const [remove] = useMutation(DELETE_SYSTEM_KEY);
  return (
    <ApiKeyFormPage
      ownerName={
        apiKey.owner?.__typename === "SystemAccount"
          ? apiKey.owner.name
          : undefined
      }
      key={apiKey.id + apiKey.enabled + apiKey.permissions.join()}
      apiKey={apiKey}
      canWrite={ability.can(
        "write",
        createAbilitySubject("SystemAccountApiKey", apiKey),
      )}
      canEditName={ability.can(
        "write",
        createAbilitySubject("SystemAccountApiKey", apiKey),
        "name",
      )}
      canEditPermissions={ability.can(
        "write",
        createAbilitySubject("SystemAccountApiKey", apiKey),
        "permissions",
      )}
      listPath="/admin/api-keys"
      listSearch={backSearch}
      permissionValues={Object.values(SystemAccountPermission)}
      permissionOptions={getPermissionOptions(permissionOptions)}
      permissionsHint={t("admin:system_accounts.key_permissions_hint")}
      onSave={async (input) => {
        await update({
          variables: {
            id: apiKey.id,
            input: {
              ...(input.name !== apiKey.name ? { name: input.name } : {}),
              ...([...input.permissions].sort().join() !==
              [...apiKey.permissions].sort().join()
                ? { permissions: input.permissions }
                : {}),
            },
          },
        });
        await refreshAfterMutation(() => router.invalidate());
      }}
      onToggle={async () => {
        await update({
          variables: { id: apiKey.id, input: { enabled: !apiKey.enabled } },
        });
        await refreshAfterMutation(() => router.invalidate());
      }}
      onDelete={async () => {
        await remove({ variables: { id: apiKey.id } });
        await navigate({
          to: "/admin/api-keys",
          search: backSearch,
        });
      }}
    />
  );
}
