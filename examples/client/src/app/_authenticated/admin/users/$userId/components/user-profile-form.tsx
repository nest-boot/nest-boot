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
import { Input } from "@/components/thread-ui/input";

const UPDATE_USER_FROM_USER_ROUTE = graphql(`
  mutation updateManagedUserFromUserRoute($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
    }
  }
`);

export function UserProfileForm({
  user,
  run,
}: {
  user: NonNullable<GetUserFromUserRouteQuery["user"]>;
  run: (operation: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const userId = user.id;
  const ability = useAbility();
  const userSubject = createAbilitySubject("User", user);
  const canUpdate = ability.can("update", userSubject);
  const canSetEmail = canUpdate && ability.can("set-email", userSubject);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailVerified, setEmailVerified] = useState(user.emailVerified);
  const [updateUser, { loading: updating }] = useMutation(
    UPDATE_USER_FROM_USER_ROUTE,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin:user.profile.title")}</CardTitle>
        <CardDescription>{t("admin:user.profile.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label={t("admin:users.table.name")}
          data-testid="admin-user-name"
          disabled={!canUpdate}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          type="email"
          label={t("admin:users.table.email")}
          data-testid="admin-user-email"
          disabled={!canSetEmail}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emailVerified}
            disabled={!canSetEmail}
            onChange={(event) => setEmailVerified(event.target.checked)}
          />
          {t("admin:user.profile.email_verified")}
        </label>
        <Button
          loading={updating}
          data-testid="admin-user-profile-save"
          disabled={!canUpdate}
          onClick={() =>
            run(
              () =>
                updateUser({
                  variables: {
                    id: userId,
                    input: {
                      name,
                      ...(canSetEmail ? { email, emailVerified } : {}),
                    },
                  },
                }),
              t("admin:user.profile.success"),
            )
          }
        >
          {t("action.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
