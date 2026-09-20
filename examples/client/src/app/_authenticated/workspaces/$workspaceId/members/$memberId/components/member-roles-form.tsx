import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { t } from "i18next";
import { z } from "zod";

import type { MemberFormProps } from "./member-form-props";
import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";
import { WorkspaceRole } from "@/gql/graphql";
import { graphql } from "@/gql";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { Button } from "@/components/thread-ui/button";
import {
  Field,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

const SET_MEMBER_ROLES = graphql(`
  mutation setMemberRolesFromMemberRoute(
    $id: ID!
    $input: SetMemberRolesInput!
  ) {
    setMemberRoles(id: $id, input: $input) {
      id
    }
  }
`);

export function MemberRolesForm({
  member,
  disabled,
  onSave,
  options,
}: MemberFormProps & {
  options: GetMemberFromMemberRouteQuery["workspaceRoles"];
}) {
  const [setRoles] = useMutation(SET_MEMBER_ROLES);
  const form = useForm({
    defaultValues: { roles: member.roles },
    validators: {
      onSubmit: z.object({ roles: z.array(z.enum(WorkspaceRole)).min(1) }),
    },
    onSubmit: async ({ value }) => {
      const saved = await onSave(async () => {
        if (
          value.roles.some(
            (role) =>
              !options.some(
                (option) => option.role === role && option.grantable,
              ),
          )
        )
          throw new Error("Selected roles exceed your grant permissions");
        await setRoles({ variables: { id: member.id, input: value } });
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
        <FieldLegend>{t("member:details.sections.roles")}</FieldLegend>
        <FieldGroup>
          <form.Field name="roles">
            {(field) => (
              <RoleCheckboxGroup
                label={t("member:details.form.role.label")}
                options={options}
                testIdPrefix="member-role"
                value={field.state.value}
                onValueChange={field.handleChange}
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
                  data-testid="member-roles-save"
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
