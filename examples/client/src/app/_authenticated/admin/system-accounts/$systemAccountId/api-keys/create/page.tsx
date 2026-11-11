import { useRef } from "react";
import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { SystemAccountPermission } from "@/gql/graphql";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { CREATE_SYSTEM_KEY } from "@/graphql/system-accounts";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
} from "@/lib/permissions";
import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";

export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/$systemAccountId/api-keys/create/",
)({
  component: Create,
  beforeLoad: ({ context, params }) => {
    if (
      !context.account.enabled ||
      !context.ability.can("write", "SystemAccountApiKey")
    )
      throw redirect({
        to: "/admin/system-accounts/$systemAccountId/api-keys",
        params,
      });
  },
});
function Create() {
  const { account } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const issued = useRef<{ id: string; secret: string } | undefined>(undefined);
  const { setCreatedKey } = useCreatedApiKey();
  const user = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [user.id, "admin", "system-accounts", account.id, "api-keys"],
    searchSchema: apiKeySearchSchema,
  });
  const [create] = useMutation(CREATE_SYSTEM_KEY, { fetchPolicy: "no-cache" });
  return (
    <ApiKeyFormPage
      canWrite
      listPath={`/admin/system-accounts/${account.id}/api-keys`}
      listSearch={backSearch}
      permissionValues={Object.values(SystemAccountPermission)}
      permissionOptions={getPermissionOptions(account.apiKeyPermissions ?? [])}
      defaultPermissions={getDefaultApiKeyPermissions(
        account.apiKeyPermissions ?? [],
      )}
      permissionsHint={t("admin:system_accounts.key_permissions_hint")}
      onSave={async (input) => {
        if (!issued.current) {
          const { data } = await create({
            variables: { systemAccountId: account.id, input },
          });
          const created = data?.createSystemAccountApiKey;
          if (!created) throw new Error(t("api-key:form.save_failed"));
          issued.current = { id: created.entity.id, secret: created.apiKey };
        }
        setCreatedKey({
          pathname: `/admin/system-accounts/${account.id}/api-keys/${issued.current.id}`,
          secret: issued.current.secret,
        });
        await navigate({
          to: "/admin/system-accounts/$systemAccountId/api-keys/$apiKeyId",
          params: { systemAccountId: account.id, apiKeyId: issued.current.id },
          replace: true,
        });
      }}
    />
  );
}
