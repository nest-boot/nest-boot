import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import type { MemberFormProps } from "./member-form-props";
import type { GetMemberFromMemberRouteQuery } from "@/gql/graphql";
import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { WorkspacePermission } from "@/gql/graphql";
import { graphql } from "@/gql";
import { getPermissionOptions } from "@/lib/permissions";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { Button } from "@/components/thread-ui/button";
import { FieldSet } from "@/components/ui/field";

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
  const { t } = useTranslation();
  const formId = useId();
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
            aria-label={t("member:details.sections.permissions")}
          >
            <FormLayout>
              <FormLayoutItem>
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
