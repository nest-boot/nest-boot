import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { t } from "i18next";
import { z } from "zod";

import type { MemberFormProps } from "./member-form-props";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { graphql } from "@/gql";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { Field, FieldSet } from "@/components/ui/field";

const UPDATE_MEMBER = graphql(`
  mutation updateMemberFromMemberRoute($id: ID!, $input: UpdateMemberInput!) {
    updateMember(id: $id, input: $input) {
      id
    }
  }
`);

export function MemberProfileForm({
  member,
  disabled,
  onSave,
}: MemberFormProps) {
  const [updateMember] = useMutation(UPDATE_MEMBER);
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
        updateMember({
          variables: {
            id: member.id,
            input: { name: value.name.trim(), email: value.email || null },
          },
        }),
      );
      if (saved) form.reset({ ...value, name: value.name.trim() });
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
      <FieldSet
        disabled={disabled}
        aria-label={t("member:details.sections.profile")}
      >
        <FormLayout>
          {(["name", "email"] as const).map((name) => (
            <FormLayoutItem key={name}>
              <form.Field name={name}>
                {(field) => (
                  <Input
                    id={`member-${name}`}
                    label={t(`member:details.form.${name}.label`)}
                    description={t(`member:details.form.${name}.description`)}
                    disabled={disabled}
                    error={field.state.meta.errors
                      .map((error) => error?.message)
                      .filter(Boolean)
                      .join(", ")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              </form.Field>
            </FormLayoutItem>
          ))}
          <FormLayoutItem>
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
                    data-testid="member-profile-save"
                    disabled={disabled || !isDirty || !canSubmit}
                    loading={isSubmitting}
                  >
                    {t("action.save")}
                  </Button>
                </Field>
              )}
            </form.Subscribe>
          </FormLayoutItem>
        </FormLayout>
      </FieldSet>
    </form>
  );
}
