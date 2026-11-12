import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import type { WorkspaceMemberFormProps } from "./workspace-member-form-props";
import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { graphql } from "@/gql";
import { WorkspaceMemberType } from "@/gql/graphql";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { FieldSet } from "@/components/ui/field";

const UPDATE_WORKSPACE_MEMBER = graphql(`
  mutation updateWorkspaceMemberFromWorkspaceMemberRoute(
    $id: ID!
    $input: UpdateWorkspaceMemberInput!
  ) {
    updateWorkspaceMember(id: $id, input: $input) {
      id
    }
  }
`);

export function WorkspaceMemberProfileForm({
  member,
  disabled,
  onSave,
}: WorkspaceMemberFormProps) {
  const { t } = useTranslation();
  const formId = useId();
  const isWorkspaceServiceAccount =
    member.type === WorkspaceMemberType.SERVICE_ACCOUNT;
  const fields = isWorkspaceServiceAccount
    ? (["name"] as const)
    : (["name", "email"] as const);
  const [updateWorkspaceMember] = useMutation(UPDATE_WORKSPACE_MEMBER);
  const form = useForm({
    defaultValues: { name: member.name, email: member.email ?? "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1).max(255),
        email: z.string().email().or(z.literal("")),
      }),
    },
    onSubmit: async ({ value }) => {
      const saved = await onSave(() =>
        updateWorkspaceMember({
          variables: {
            id: member.id,
            input: {
              name: value.name.trim(),
              ...(!isWorkspaceServiceAccount
                ? { email: value.email || null }
                : {}),
            },
          },
        }),
      );
      if (saved) form.reset({ ...value, name: value.name.trim() });
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
            aria-label={t("workspace-member:details.sections.profile")}
          >
            <FormLayout>
              {fields.map((name) => (
                <FormLayoutItem key={name}>
                  <form.Field name={name}>
                    {(field) => (
                      <Input
                        id={`member-${name}`}
                        label={t(`workspace-member:details.form.${name}.label`)}
                        description={
                          isWorkspaceServiceAccount
                            ? undefined
                            : t(
                                `workspace-member:details.form.${name}.description`,
                              )
                        }
                        disabled={disabled}
                        error={field.state.meta.errors
                          .map((error) => error?.message)
                          .filter(Boolean)
                          .join(", ")}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>
              ))}
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
