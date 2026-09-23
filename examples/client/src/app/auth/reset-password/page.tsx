import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AuthPageShell } from "../components/auth-page-shell";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { FieldError } from "@/components/ui/field";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { graphql } from "@/gql";

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
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/reset-password/" });
  const [resetPassword] = useMutation(RESET_PASSWORD_FROM_RESET_PASSWORD);
  const [completed, setCompleted] = useState(false);
  const invalidToken = Boolean(search.error || !search.token);

  const form = useForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    validators: { onSubmit: createResetPasswordSchema() },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
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
  const loading = useStore(form.store, (state) => state.isSubmitting);
  const error = useStore(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <AuthPageShell>
      <Card data-testid="reset-password-view">
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
                event.preventDefault();
                event.stopPropagation();
                if (form.state.isSubmitting) return;
                form.setErrorMap({ onSubmit: undefined });
                form.handleSubmit();
              }}
            >
              <FormLayout>
                <FormLayoutItem>
                  <form.Field name="newPassword">
                    {(field) => (
                      <Input
                        id="reset-password-new"
                        data-testid="reset-password-new"
                        type="password"
                        autoComplete="new-password"
                        label={t("auth:passwordReset.newPassword")}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        error={getFormErrorMessage(field.state.meta.errors)}
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>
                <FormLayoutItem>
                  <form.Field name="confirmPassword">
                    {(field) => (
                      <Input
                        id="reset-password-confirm"
                        data-testid="reset-password-confirm"
                        type="password"
                        autoComplete="new-password"
                        label={t("auth:passwordReset.confirmPassword")}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        error={getFormErrorMessage(field.state.meta.errors)}
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
            <Button
              type="submit"
              form="reset-password-form"
              className="w-full"
              data-testid="reset-password-submit"
              loading={loading}
            >
              {t("auth:passwordReset.resetSubmit")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}

function createResetPasswordSchema() {
  return z
    .object({
      newPassword: z.string().min(8, t("auth:form.password.min")),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: t("auth:passwordReset.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
