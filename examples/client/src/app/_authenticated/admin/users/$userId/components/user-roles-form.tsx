import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { t } from "i18next";
import type { GetUserFromUserRouteQuery } from "@/gql/graphql";
import { graphql } from "@/gql";
import { useAbility } from "@/contexts/ability-context";
import { createAbilitySubject } from "@/lib/ability";
import { Button } from "@/components/thread-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";

const SET_USER_ROLES_FROM_USER_ROUTE = graphql(`
  mutation setUserRolesFromUserRoute($id: ID!, $input: SetUserRolesInput!) {
    setUserRoles(id: $id, input: $input) {
      id
    }
  }
`);

export function UserRolesForm({
  user,
  run,
  options,
}: {
  user: NonNullable<GetUserFromUserRouteQuery["user"]>;
  run: (operation: () => Promise<unknown>, message: string) => Promise<void>;

  options: NonNullable<GetUserFromUserRouteQuery["userRoles"]>;
}) {
  const userId = user.id;
  const ability = useAbility();
  const userSubject = createAbilitySubject("User", user);
  const canSetRoles = ability.can("set-roles", userSubject);
  const [roles, setRoles] = useState(user.roles);
  const [setUserRoles, { loading: savingRole }] = useMutation(
    SET_USER_ROLES_FROM_USER_ROUTE,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin:user.roles.title")}</CardTitle>
        <CardDescription>{t("admin:user.roles.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RoleCheckboxGroup
          label={t("admin:user.roles.label")}
          options={options ?? []}
          testIdPrefix="user-role"
          value={roles}
          disabled={!canSetRoles}
          onValueChange={setRoles}
        />
        <Button
          data-testid="admin-user-roles-save"
          disabled={
            !canSetRoles ||
            roles.length === 0 ||
            roles.some(
              (role) =>
                !options?.some(
                  (option) => option.role === role && option.grantable,
                ),
            )
          }
          loading={savingRole}
          onClick={() =>
            run(
              () =>
                setUserRoles({
                  variables: {
                    id: userId,
                    input: { roles },
                  },
                }),
              t("admin:user.roles.success"),
            )
          }
        >
          {t("action.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
