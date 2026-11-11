import { useMutation } from "@apollo/client/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { SystemAccountFormPage } from "@/components/system-account-form-page";
import {
  DELETE_SYSTEM_ACCOUNT,
  UPDATE_SYSTEM_ACCOUNT,
} from "@/graphql/system-accounts";
import { getPermissionOptions } from "@/lib/permissions";
import { createAbilitySubject } from "@/lib/ability";
import { useAbility } from "@/contexts/ability-context";
import { systemAccountSearchSchema } from "@/schemas/system-account-search-schema";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/$systemAccountId/",
)({ component: Details });
function Details() {
  const { account, accountPermissionOptions } = Route.useRouteContext();
  const ability = useAbility();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const user = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [user.id, "admin", "system-accounts"],
    searchSchema: systemAccountSearchSchema,
  });
  const [update] = useMutation(UPDATE_SYSTEM_ACCOUNT);
  const [remove] = useMutation(DELETE_SYSTEM_ACCOUNT);
  return (
    <SystemAccountFormPage
      key={
        account.id + account.enabled + account.name + account.permissions.join()
      }
      account={account}
      canWrite={ability.can(
        "write",
        createAbilitySubject("SystemAccount", account),
      )}
      canEditName={ability.can(
        "write",
        createAbilitySubject("SystemAccount", account),
        "name",
      )}
      canEditPermissions={ability.can(
        "write",
        createAbilitySubject("SystemAccount", account),
        "permissions",
      )}
      canToggle={ability.can(
        "write",
        createAbilitySubject("SystemAccount", account),
        "enabled",
      )}
      canReadKeys={ability.can("read", "SystemAccountApiKey")}
      options={getPermissionOptions(accountPermissionOptions)}
      onSave={async (input) => {
        await update({
          variables: {
            id: account.id,
            input: {
              ...(input.name !== account.name ? { name: input.name } : {}),
              ...(input.permissions !== undefined
                ? { permissions: input.permissions }
                : {}),
            },
          },
        });
        await refreshAfterMutation(() => router.invalidate());
      }}
      onToggle={async () => {
        await update({
          variables: { id: account.id, input: { enabled: !account.enabled } },
        });
        await refreshAfterMutation(() => router.invalidate());
      }}
      onDelete={async () => {
        await remove({ variables: { id: account.id } });
        await navigate({ to: "/admin/system-accounts", search: backSearch });
      }}
    />
  );
}
