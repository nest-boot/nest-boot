import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { t } from "i18next";
import { z } from "zod";

import type { MemberFormProps } from "./member-form-props";
import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";
import { WorkspacePermission } from "@/gql/graphql";
import { graphql } from "@/gql";
import { getPermissionOptions } from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { Button } from "@/components/thread-ui/button";
import {
  Field,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

const SET_MEMBER_PERMISSIONS = graphql(`
  mutation setMemberPermissionsFromMemberRoute(
    $id: ID!
    $input: SetMemberPermissionsInput!
  ) {
    setMemberPermissions(id: $id, input: $input) {
      id
    }
  }
`);

export function MemberPermissionsForm({
  member,
  disabled,
  onSave,
  options,
}: MemberFormProps & {
  options: GetMemberFromMemberRouteQuery["workspacePermissions"];
}) {
  const [setPermissions] = useMutation(SET_MEMBER_PERMISSIONS);
  const form = useForm({
    defaultValues: { permissions: member.permissions },
    validators: {
      onSubmit: z.object({ permissions: z.array(z.enum(WorkspacePermission)) }),
    },
    onSubmit: async ({ value }) => {
      const saved = await onSave(async () => {
        if (
          value.permissions.some(
            (permission) =>
              !options.some(
                (option) =>
                  option.permission === permission && option.grantable,
              ),
          )
        )
          throw new Error("Selected permissions exceed your grant permissions");
        await setPermissions({ variables: { id: member.id, input: value } });
      }, true);
      if (saved) form.reset(value);
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldSet disabled={disabled}>
        <FieldLegend>{t("member:details.sections.permissions")}</FieldLegend>
        <FieldGroup>
          <form.Field name="permissions">
            {(field) => (
              <PermissionCheckboxGroup
                options={getPermissionOptions(options)}
                value={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) => [
              state.isDirty,
              state.canSubmit,
              state.isSubmitting,
            ]}
          >
            {([isDirty, canSubmit, isSubmitting]) => (
              <Field orientation="horizontal">
                <Button
                  type="submit"
                  data-testid="member-permissions-save"
                  disabled={disabled || !isDirty || !canSubmit}
                  loading={isSubmitting}
                >
                  {t("action.save")}
                </Button>
              </Field>
            )}
          </form.Subscribe>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
