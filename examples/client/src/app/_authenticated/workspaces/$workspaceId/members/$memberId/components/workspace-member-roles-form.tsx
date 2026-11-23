import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useForm } from "@tanstack/react-form";
import type { WorkspaceMemberFormProps } from "./workspace-member-form-props";
import type { GetWorkspaceMemberFromWorkspaceMemberRouteQuery } from "@/gql/graphql";
import { defaultFormOptions, resetFormAfterSave, submitForm } from "@/lib/form";
import { useFormChanges, useSyncFormChanges } from "@/hooks/use-form-changes";
import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { WorkspaceMemberType, WorkspaceRole } from "@/gql/graphql";
import { getFormErrorMessage } from "@/lib/form-errors";
import { graphql } from "@/gql";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";

import { FieldError, FieldSet } from "@/components/ui/field";
import { SubmitButton } from "@/components/form/submit-button";

const SET_WORKSPACE_MEMBER_ROLES = graphql(`
  mutation setWorkspaceMemberRolesFromWorkspaceMemberRoute(
    $id: ID!
    $input: SetWorkspaceMemberRolesInput!
  ) {
    setWorkspaceMemberRoles(id: $id, input: $input) {
      id
    }
  }
`);

export function WorkspaceMemberRolesForm({
  member,
  disabled,
  onSave,
  options,
}: WorkspaceMemberFormProps & {
  options: GetWorkspaceMemberFromWorkspaceMemberRouteQuery["workspaceRoles"];
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [setRoles] = useMutation(SET_WORKSPACE_MEMBER_ROLES);
  const roleChanges = useFormChanges(
    { roles: member.roles },
    { revision: member.updatedAt, setFields: ["roles"] },
  );
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: roleChanges.defaultValues,
    validators: {
      onDynamic: z.object({
        roles: z
          .array(z.enum(WorkspaceRole))
          .refine(
            (roles) =>
              member.type === WorkspaceMemberType.SERVICE_ACCOUNT ||
              roles.length > 0,
            t("workspace-member:invite.role_required"),
          )
          .refine(
            (roles) =>
              roles.every((role) =>
                options.some(
                  (option) => option.role === role && option.grantable,
                ),
              ),
            t("workspace-member:invite.role_invalid"),
          ),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!roleChanges.getChanges(value).roles) return;
      const saved = await onSave(async () => {
        await setRoles({ variables: { id: member.id, input: value } });
      }, true);
      if (saved) {
        roleChanges.accept(value);
        resetFormAfterSave(form, value);
      }
    },
  });
  useSyncFormChanges(form, roleChanges);
  return (
    <>
      <CardContent>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            void submitForm(event, form);
          }}
        >
          <FieldSet
            disabled={disabled}
            aria-label={t("workspace-member:details.sections.roles")}
          >
            <FormLayout>
              <FormLayoutItem>
                <form.Field name="roles">
                  {(field) => (
                    <>
                      <RoleCheckboxGroup
                        label={t("workspace-member:details.form.role.label")}
                        options={options}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        disabled={disabled}
                      />
                      <FieldError>
                        {getFormErrorMessage(field.state.meta.errors)}
                      </FieldError>
                    </>
                  )}
                </form.Field>
              </FormLayoutItem>
            </FormLayout>
          </FieldSet>
        </form>
      </CardContent>
      <CardFooter>
        <SubmitButton
          formApi={form}
          form={formId}
          requireDirty
          disabled={disabled}
        >
          {t("action.save")}
        </SubmitButton>
      </CardFooter>
    </>
  );
}
