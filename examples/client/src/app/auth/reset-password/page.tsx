import { useState } from "react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AuthPageShell } from "../components/auth-page-shell";
import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { usePasswordPolicy } from "@/hooks/use-password-policy";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { FieldError } from "@/components/ui/field";
import { Button } from "@/components/thread-ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { graphql } from "@/gql";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";

const RESET_PASSWORD_FROM_RESET_PASSWORD = graphql(`
  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {
    resetPassword(input: $input)
  }
`);

export const Route = createFileRoute("/auth/reset-password/")({
  component: ResetPasswordComponent,
  validateSearch: zodValidator(
    z.object({
      error: z.string().optional(),
      token: z.string().optional(),
    }),
  ),
});

function ResetPasswordComponent() {
  const { passwordSchema } = usePasswordPolicy();
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/reset-password/" });
  const [resetPassword] = useMutation(RESET_PASSWORD_FROM_RESET_PASSWORD);
  const [completed, setCompleted] = useState(false);
  const invalidToken = Boolean(search.error || !search.token);

  const form = useForm({
    ...defaultFormOptions,
    defaultValues: { newPassword: "", confirmPassword: "" },
    validators: { onDynamic: createResetPasswordSchema(passwordSchema) },

    onSubmit: async ({ value, formApi }) => {
      if (invalidToken || !search.token) return;
      try {
        const result = await resetPassword({
          variables: {
            input: {
              newPassword: value.newPassword,
              token: search.token,
            },
          },
        });

        if (!result.data?.resetPassword) {
          throw new Error(t("auth:passwordReset.resetFailed"));
        }

        setCompleted(true);
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : t("auth:passwordReset.resetFailed"),
            fields: {},
          },
        });
      }
    },
  });

  const error = useSelector(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <AuthPageShell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth:passwordReset.resetTitle")}</CardTitle>
          <CardDescription>
            {completed
              ? t("auth:passwordReset.resetSuccessDescription")
              : invalidToken
                ? t("auth:passwordReset.invalidDescription")
                : t("auth:passwordReset.resetDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completed || invalidToken ? (
            <div className="flex flex-col items-center gap-5 text-center">
              {completed ? (
                <CircleCheck className="text-primary size-10" />
              ) : (
                <CircleX className="text-destructive size-10" />
              )}
            </div>
          ) : (
            <form
              noValidate
              id="reset-password-form"
              onSubmit={(event) => {
                void submitForm(event, form);
              }}
            >
              <FormLayout>
                <FormLayoutItem>
                  <form.Field name="newPassword">
                    {(field) => (
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={() => handleFieldBlur(field)}
                        error={getFormErrorMessage(field.state.meta.errors)}
                        id="reset-password-new"
                        type="password"
                        autoComplete="new-password"
                        label={t("auth:passwordReset.newPassword")}
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>
                <FormLayoutItem>
                  <form.Field name="confirmPassword">
                    {(field) => (
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={() => handleFieldBlur(field)}
                        error={getFormErrorMessage(field.state.meta.errors)}
                        id="reset-password-confirm"
                        type="password"
                        autoComplete="new-password"
                        label={t("auth:passwordReset.confirmPassword")}
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>

                {error && (
                  <FormLayoutItem>
                    <FieldError>{error}</FieldError>
                  </FormLayoutItem>
                )}
              </FormLayout>
            </form>
          )}
        </CardContent>
        <CardFooter>
          {completed || invalidToken ? (
            <Button
              className="w-full"
              variant="outline"
              render={
                <Link
                  to={completed ? "/auth/login" : "/auth/forgot-password"}
                />
              }
            >
              {completed
                ? t("auth:passwordReset.signIn")
                : t("auth:passwordReset.requestNewLink")}
            </Button>
          ) : (
            <SubmitButton
              formApi={form}
              form="reset-password-form"
              className="w-full"
            >
              {t("auth:passwordReset.resetSubmit")}
            </SubmitButton>
          )}
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}

function createResetPasswordSchema(passwordSchema: z.ZodType<string, string>) {
  return z
    .object({
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: t("auth:passwordReset.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
