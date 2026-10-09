import { useId, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type {
  GetServiceAccountGrantsFromCreateMemberRouteQuery,
  WorkspacePermission,
  WorkspaceRole,
} from "@/gql/graphql";
import { graphql } from "@/gql";
import { MemberType } from "@/gql/graphql";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { FieldError } from "@/components/ui/field";
import { getPermissionOptions } from "@/lib/permissions";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const ADD_SERVICE_ACCOUNT = graphql(`
  mutation addServiceAccountFromMembersRoute($input: AddMemberInput!) {
    addMember(input: $input) {
      id
    }
  }
`);

/** Creates an automation identity, then opens its existing member editor. */
export function ServiceAccountForm({
  workspaceId,
  roleOptions,
  permissionOptions,
}: {
  workspaceId: string;
  roleOptions: GetServiceAccountGrantsFromCreateMemberRouteQuery["workspaceRoles"];
  permissionOptions: GetServiceAccountGrantsFromCreateMemberRouteQuery["workspacePermissions"];
}) {
  const { t } = useTranslation();
  const id = useId();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Array<WorkspaceRole>>([]);
  const [permissions, setPermissions] = useState<Array<WorkspacePermission>>(
    [],
  );
  const [error, setError] = useState<string>();
  const [addMember, { loading }] = useMutation(ADD_SERVICE_ACCOUNT);
  return (
    <form
      id={id}
      onSubmit={async (event) => {
        event.preventDefault();
        if (loading || !name.trim()) return;
        setError(undefined);
        try {
          const result = await addMember({
            variables: {
              input: {
                type: MemberType.SERVICE_ACCOUNT,
                name: name.trim(),
                ...(roles.length || permissions.length ? { roles } : {}),
                permissions,
              },
            },
          });
          const memberId = result.data?.addMember.id;
          if (!memberId) throw new Error(t("member:service_account.failed"));
          await navigate({
            to: "/workspaces/$workspaceId/members/$memberId",
            params: { workspaceId, memberId },
          });
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("member:service_account.failed"),
          );
        }
      }}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <FormLayout>
                <FormLayoutItem>
                  <Input
                    id={`${id}-name`}
                    label={t("member:table.name")}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={255}
                    required
                    disabled={loading}
                  />
                </FormLayoutItem>
              </FormLayout>
            </CardContent>
          </Card>
        </PageLayoutSection>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <FormLayout>
                <FormLayoutItem>
                  <RoleCheckboxGroup
                    label={t("member:details.form.role.label")}
                    options={roleOptions}
                    value={roles}
                    onValueChange={setRoles}
                    disabled={loading}
                  />
                </FormLayoutItem>
              </FormLayout>
            </CardContent>
          </Card>
        </PageLayoutSection>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <FormLayout>
                <FormLayoutItem>
                  <PermissionCheckboxGroup
                    options={getPermissionOptions(permissionOptions)}
                    value={permissions}
                    onChange={setPermissions}
                    disabled={loading}
                  />
                </FormLayoutItem>
                <FormLayoutItem>
                  <p className="text-muted-foreground text-sm">
                    {t("member:service_account.default_grants")}
                  </p>
                </FormLayoutItem>
                {error && (
                  <FormLayoutItem>
                    <FieldError>{error}</FieldError>
                  </FormLayoutItem>
                )}
              </FormLayout>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                form={id}
                disabled={loading || !name.trim()}
                loading={loading}
              >
                {t("action.create")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </form>
  );
}
