import { useId } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import {
  defaultFormOptions,
  handleFieldBlur,
  resetFormAfterSave,
  submitForm,
} from "@/lib/form";
import { useFormChanges, useSyncFormChanges } from "@/hooks/use-form-changes";

import { CardContent, CardFooter } from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { graphql } from "@/gql";
import { WorkspaceMemberType } from "@/gql/graphql";

import { FieldSet } from "@/components/ui/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";
import { getFormErrorMessage } from "@/lib/form-errors";
import type { WorkspaceMemberFormProps } from "./workspace-member-form-props";

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
  const profileChanges = useFormChanges(
    {
      name: member.name.trim(),
      email: member.email ?? "",
    },
    {
      revision: member.updatedAt,
      normalize: (values) => ({
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
      }),
    },
  );
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: profileChanges.defaultValues,
    validators: {
      onDynamic: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("user:profile.form.name.required"))
          .max(255, t("common:validation.max_length", { max: 255 })),
        email: z
          .string()
          .trim()
          .pipe(
            z
              .string()
              .email(t("auth:form.email.invalid"))
              .max(255, t("auth:form.email.invalid"))
              .or(z.literal("")),
          ),
      }),
    },
    onSubmit: async ({ value }) => {
      const values = profileChanges.normalize(value);
      const changes = profileChanges.getChanges(values);
      const input = {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(!isWorkspaceServiceAccount && changes.email !== undefined
          ? { email: changes.email || null }
          : {}),
      };
      if (!Object.keys(input).length) return;
      const saved = await onSave(() =>
        updateWorkspaceMember({
          variables: {
            id: member.id,
            input,
          },
        }),
      );
      if (saved) {
        profileChanges.accept(values);
        resetFormAfterSave(form, value, values);
      }
    },
  });
  useSyncFormChanges(form, profileChanges);
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
            aria-label={t("workspace-member:details.sections.profile")}
          >
            <FormLayout>
              {fields.map((name) => (
                <FormLayoutItem key={name}>
                  <form.Field name={name}>
                    {(field) => (
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={() => handleFieldBlur(field)}
                        error={getFormErrorMessage(field.state.meta.errors)}
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
