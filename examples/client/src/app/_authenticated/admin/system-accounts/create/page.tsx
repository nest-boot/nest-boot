import { useRef } from "react";
import { t } from "i18next";
import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SystemAccountFormPage } from "@/components/system-account-form-page";
import { CREATE_SYSTEM_ACCOUNT } from "@/graphql/system-accounts";
import { getPermissionOptions } from "@/lib/permissions";

export const Route = createFileRoute(
  "/_authenticated/admin/system-accounts/create/",
)({
  component: Create,
  beforeLoad: ({ context }) => {
    if (!context.ability.can("write", "SystemAccount"))
      throw redirect({ to: "/admin/system-accounts" });
  },
});
function Create() {
  const { accountPermissionOptions } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const createdId = useRef<string | undefined>(undefined);
  const [create] = useMutation(CREATE_SYSTEM_ACCOUNT);
  return (
    <SystemAccountFormPage
      canWrite
      options={getPermissionOptions(accountPermissionOptions)}
      onSave={async (input) => {
        if (!createdId.current) {
          const { data } = await create({ variables: { input } });
          if (!data) throw new Error(t("admin:failed"));
          createdId.current = data.createSystemAccount.id;
        }
        await navigate({
          to: "/admin/system-accounts/$systemAccountId",
          params: { systemAccountId: createdId.current },
          replace: true,
        });
      }}
    />
  );
}
