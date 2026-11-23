import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import type { WorkspaceMemberFormProps } from "./workspace-member-form-props";
import type { GetWorkspaceMemberFromWorkspaceMemberRouteQuery } from "@/gql/graphql";
import { defaultFormOptions, resetFormAfterSave, submitForm } from "@/lib/form";
import { useFormChanges } from "@/hooks/use-form-changes";
import { getFormErrorMessage } from "@/lib/form-errors";

import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { WorkspacePermission } from "@/gql/graphql";
import { graphql } from "@/gql";
import { getPermissionOptions } from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";

import { FieldError, FieldSet } from "@/components/ui/field";
import { SubmitButton } from "@/components/form/submit-button";

const SET_WORKSPACE_MEMBER_PERMISSIONS = graphql(`
  mutation setWorkspaceMemberPermissionsFromWorkspaceMemberRoute(
    $id: ID!
    $input: SetWorkspaceMemberPermissionsInput!
  ) {
    setWorkspaceMemberPermissions(id: $id, input: $input) {
      id
    }
  }
`);

export function WorkspaceMemberPermissionsForm({
  member,
  disabled,
  onSave,
  options,
}: WorkspaceMemberFormProps & {
  options: GetWorkspaceMemberFromWorkspaceMemberRouteQuery["workspacePermissions"];
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [setPermissions] = useMutation(SET_WORKSPACE_MEMBER_PERMISSIONS);
  const permissionChanges = useFormChanges(
    { permissions: member.permissions },
    { setFields: ["permissions"] },
  );
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: permissionChanges.defaultValues,
    validators: {
      onDynamic: z.object({
        permissions: z
          .array(z.enum(WorkspacePermission))
          .refine(
            (permissions) =>
              permissions.every((permission) =>
                options.some(
                  (option) =>
                    option.permission === permission && option.grantable,
                ),
              ),
            t("admin:user.permissions.invalid"),
          ),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!permissionChanges.getChanges(value).permissions) return;
      const saved = await onSave(async () => {
        await setPermissions({ variables: { id: member.id, input: value } });
      }, true);
      if (saved) {
        permissionChanges.accept(value);
        resetFormAfterSave(form, value);
      }
    },
  });
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
            aria-label={t("workspace-member:details.sections.permissions")}
          >
            <FormLayout>
              <FormLayoutItem>
                <form.Field name="permissions">
                  {(field) => (
                    <>
                      <PermissionCheckboxGroup
                        options={getPermissionOptions(options)}
                        value={field.state.value}
                        onChange={field.handleChange}
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
