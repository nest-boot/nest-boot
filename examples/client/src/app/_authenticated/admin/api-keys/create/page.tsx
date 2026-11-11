import { useRef, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { SystemApiKeyPermission } from "@/gql/graphql";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import {
  CREATE_SYSTEM_ACCOUNT,
  CREATE_SYSTEM_KEY,
  SYSTEM_KEY_ACCOUNTS,
} from "@/graphql/system-accounts";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
} from "@/lib/permissions";
import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { adminApiKeysResourceKey } from "@/lib/resource-keys";
import { isAccessDenied } from "@/lib/auth-errors";

export const Route = createFileRoute("/_authenticated/admin/api-keys/create/")({
  component: Create,
  beforeLoad: async ({ context }) => {
    const denied = () => redirect({ to: "/admin/api-keys" });
    const canCreateAccount = context.ability.can("write", "SystemAccount");
    const canReadAccounts = context.ability.can("read", "SystemAccount");
    if (
      !context.ability.can("write", "SystemApiKey") ||
      (!canCreateAccount && !canReadAccounts)
    )
      throw denied();
    const read = async (after?: string) =>
      await context.apolloClient
        .query({
          query: SYSTEM_KEY_ACCOUNTS,
          variables: { after },
          fetchPolicy: "network-only",
        })
        .catch((error: unknown) => {
          if (isAccessDenied(error)) throw denied();
          throw error;
        });
    const first = canReadAccounts ? await read() : undefined;
    const accounts =
      first?.data?.systemAccounts.edges.map(({ node }) => node) ?? [];
    let pageInfo = first?.data?.systemAccounts.pageInfo;
    while (pageInfo?.hasNextPage && pageInfo.endCursor) {
      const page = await read(pageInfo.endCursor);
      accounts.push(
        ...(page.data?.systemAccounts.edges.map(({ node }) => node) ?? []),
      );
      pageInfo = page.data?.systemAccounts.pageInfo;
    }
    return { accounts, canCreateAccount, title: t("api-key:create.title") };
  },
});
function Create() {
  const { accounts, canCreateAccount, keyPermissionOptions } =
    Route.useRouteContext();
  const [selectedId, setSelectedId] = useState("");
  const selected = accounts.find((account) => account.id === selectedId);
  const permissionOptions = selected?.apiKeyPermissions ?? keyPermissionOptions;
  const navigate = Route.useNavigate();
  const { setCreatedKey } = useCreatedApiKey();
  const user = useCurrentUserContext();
  const preparedAccount = useRef<string | undefined>(undefined);
  const issued = useRef<{ id: string; secret: string } | undefined>(undefined);
  const { backSearch } = useResourceNavigation({
    key: [user.id, ...adminApiKeysResourceKey],
    searchSchema: apiKeySearchSchema,
  });
  const [createAccount] = useMutation(CREATE_SYSTEM_ACCOUNT, {
    fetchPolicy: "no-cache",
  });
  const [createKey] = useMutation(CREATE_SYSTEM_KEY, {
    fetchPolicy: "no-cache",
  });
  return (
    <ApiKeyFormPage
      canWrite
      listPath="/admin/api-keys"
      listSearch={backSearch}
      permissionValues={Object.values(SystemApiKeyPermission)}
      permissionOptions={getPermissionOptions(permissionOptions)}
      defaultPermissions={getDefaultApiKeyPermissions(permissionOptions)}
      permissionsHint={t("admin:system_accounts.key_permissions_hint")}
      systemAccountOptions={accounts.map((account) => ({
        value: account.id,
        label: account.name,
      }))}
      canCreateSystemAccount={canCreateAccount}
      onSystemAccountChange={(id) => {
        setSelectedId(id);
        const choices =
          accounts.find((account) => account.id === id)?.apiKeyPermissions ??
          keyPermissionOptions;
        return choices
          .filter((option) => option.grantable)
          .map((option) => option.permission);
      }}
      onSave={async ({ systemAccountId, name, permissions }) => {
        if (!issued.current) {
          let accountId = systemAccountId;
          if (!accountId) {
            if (!canCreateAccount)
              throw new Error(t("admin:system_accounts.select_required"));
            if (!preparedAccount.current) {
              const { data } = await createAccount({
                variables: { input: { name, permissions } },
              });
              if (!data?.createSystemAccount.id)
                throw new Error(t("api-key:form.save_failed"));
              preparedAccount.current = data.createSystemAccount.id;
            }
            accountId = preparedAccount.current;
          }
          const { data } = await createKey({
            variables: {
              systemAccountId: accountId,
              input: { name, permissions },
            },
          });
          const created = data?.createSystemApiKey;
          if (!created) throw new Error(t("api-key:form.save_failed"));
          issued.current = { id: created.entity.id, secret: created.apiKey };
        }
        setCreatedKey({
          pathname: `/admin/api-keys/${issued.current.id}`,
          secret: issued.current.secret,
        });
        await navigate({
          to: "/admin/api-keys/$apiKeyId",
          params: { apiKeyId: issued.current.id },
          replace: true,
        });
      }}
    />
  );
}
