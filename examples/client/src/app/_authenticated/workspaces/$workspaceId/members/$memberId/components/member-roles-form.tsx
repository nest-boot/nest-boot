import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import type { MemberFormProps } from "./member-form-props";
import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";
import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { WorkspaceRole } from "@/gql/graphql";
import { graphql } from "@/gql";
import { RoleCheckboxGroup } from "@/components/role-checkbox-group";
import { Button } from "@/components/thread-ui/button";
import { FieldSet } from "@/components/ui/field";

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
  const { t } = useTranslation();
  const formId = useId();
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
    <>
      <CardContent>
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldSet
            disabled={disabled}
            aria-label={t("member:details.sections.roles")}
          >
            <FormLayout>
              <FormLayoutItem>
                <form.Field name="roles">
                  {(field) => (
                    <RoleCheckboxGroup
                      label={t("member:details.form.role.label")}
                      options={options}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      disabled={disabled}
                    />
                  )}
                </form.Field>
              </FormLayoutItem>
            </FormLayout>
          </FieldSet>
        </form>
      </CardContent>
      <CardFooter>
        <form.Subscribe
          selector={(state) => [
            state.isDirty,
            state.canSubmit,
            state.isSubmitting,
          ]}
        >
          {([isDirty, canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              form={formId}
              disabled={disabled || !isDirty || !canSubmit}
              loading={isSubmitting}
            >
              {t("action.save")}
            </Button>
          )}
        </form.Subscribe>
      </CardFooter>
    </>
  );
}
