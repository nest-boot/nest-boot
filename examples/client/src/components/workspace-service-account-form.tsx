import { useId } from "react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { graphql } from "@/gql";
import {
  WorkspaceMemberType,
  WorkspacePermission,
  WorkspaceRole,
} from "@/gql/graphql";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { FieldError } from "@/components/ui/field";
import { getPermissionOptions } from "@/lib/permissions";
import { getFormErrorMessage } from "@/lib/form-errors";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";
import type { GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQuery } from "@/gql/graphql";

const ADD_SERVICE_ACCOUNT = graphql(`
  mutation addWorkspaceServiceAccountFromWorkspaceMembersRoute(
    $input: AddWorkspaceMemberInput!
  ) {
    addWorkspaceMember(input: $input) {
      id
    }
  }
`);

/** Creates an automation identity, then opens its existing member editor. */
export function WorkspaceServiceAccountForm({
  workspaceId,
  roleOptions,
  permissionOptions,
}: {
  workspaceId: string;
  roleOptions: GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQuery["workspaceRoles"];
  permissionOptions: GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQuery["workspacePermissions"];
}) {
  const { t } = useTranslation();
  const id = useId();
  const navigate = useNavigate();
  const [addWorkspaceMember] = useMutation(ADD_SERVICE_ACCOUNT);
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: {
      name: "",
      roles: [] as Array<WorkspaceRole>,
      permissions: [] as Array<WorkspacePermission>,
    },
    validators: {
      onDynamic: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("auth:form.name.required"))
          .max(255, t("common:validation.max_length", { max: 255 })),
        roles: z.array(z.enum(WorkspaceRole)),
        permissions: z.array(z.enum(WorkspacePermission)),
      }),
    },

    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await addWorkspaceMember({
          variables: {
            input: {
              type: WorkspaceMemberType.SERVICE_ACCOUNT,
              name: value.name.trim(),
              ...(value.roles.length || value.permissions.length
                ? { roles: value.roles }
                : {}),
              permissions: value.permissions,
            },
          },
        });
        const memberId = result.data?.addWorkspaceMember.id;
        if (!memberId)
          throw new Error(t("workspace-member:service_account.failed"));
        await navigate({
          to: "/workspaces/$workspaceId/members/$memberId",
          params: { workspaceId, memberId },
        });
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : t("workspace-member:service_account.failed"),
            fields: {},
          },
        });
      }
    },
  });
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const error = useSelector(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );
  return (
    <form
      id={id}
      noValidate
      onSubmit={(event) => {
        void submitForm(event, form);
      }}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <FormLayout>
                <FormLayoutItem>
                  <form.Field name="name">
                    {(field) => (
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={() => handleFieldBlur(field)}
                        error={getFormErrorMessage(field.state.meta.errors)}
                        id={`${id}-name`}
                        label={t("workspace-member:table.name")}
                        maxLength={255}
                        required
                        disabled={submitting}
                      />
                    )}
                  </form.Field>
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
                  <form.Field name="roles">
                    {(field) => (
                      <RoleCheckboxGroup
                        label={t("workspace-member:details.form.role.label")}
                        options={roleOptions}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        disabled={submitting}
                      />
                    )}
                  </form.Field>
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
                  <form.Field name="permissions">
                    {(field) => (
                      <PermissionCheckboxGroup
                        options={getPermissionOptions(permissionOptions)}
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={submitting}
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>
                <FormLayoutItem>
                  <p className="text-muted-foreground text-sm">
                    {t("workspace-member:service_account.default_grants")}
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
              <SubmitButton formApi={form} form={id}>
                {t("action.create")}
              </SubmitButton>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </form>
  );
}
