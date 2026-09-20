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
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { getPermissionOptions } from "@/lib/permissions";

const SET_USER_PERMISSIONS_FROM_USER_ROUTE = graphql(`
  mutation setUserPermissionsFromUserRoute(
    $id: ID!
    $input: SetUserPermissionsInput!
  ) {
    setUserPermissions(id: $id, input: $input) {
      id
    }
  }
`);

export function UserPermissionsForm({
  user,
  run,
  options,
}: {
  user: NonNullable<GetUserFromUserRouteQuery["user"]>;
  run: (operation: () => Promise<unknown>, message: string) => Promise<void>;

  options: NonNullable<GetUserFromUserRouteQuery["userPermissions"]>;
}) {
  const userId = user.id;
  const ability = useAbility();
  const userSubject = createAbilitySubject("User", user);
  const canSetPermissions = ability.can("set-permissions", userSubject);
  const [permissions, setPermissions] = useState(user.permissions);
  const [setUserPermissions, { loading: savingPermissions }] = useMutation(
    SET_USER_PERMISSIONS_FROM_USER_ROUTE,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin:user.permissions.title")}</CardTitle>
        <CardDescription>
          {t("admin:user.permissions.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionCheckboxGroup
          options={getPermissionOptions(options ?? [])}
          value={permissions}
          disabled={!canSetPermissions}
          onChange={setPermissions}
        />
        <Button
          loading={savingPermissions}
          data-testid="admin-user-permissions-save"
          disabled={
            !canSetPermissions ||
            permissions.some(
              (permission) =>
                !options?.some(
                  (option) =>
                    option.permission === permission && option.grantable,
                ),
            )
          }
          onClick={() =>
            run(
              () =>
                setUserPermissions({
                  variables: {
                    id: userId,
                    input: { permissions },
                  },
                }),
              t("admin:user.permissions.success"),
            )
          }
        >
          {t("action.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
