import { useState } from "react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Button } from "@/components/thread-ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { graphql } from "@/gql";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";
import { AuthPageShell } from "../components/auth-page-shell";

const REQUEST_PASSWORD_RESET_FROM_FORGOT_PASSWORD = graphql(`
  mutation requestPasswordResetFromForgotPassword(
    $input: AuthRequestPasswordResetInput!
  ) {
    requestPasswordReset(input: $input) {
      status
    }
  }
`);

export const Route = createFileRoute("/auth/forgot-password/")({
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const { t } = useTranslation();
  const [requestPasswordReset] = useMutation(
    REQUEST_PASSWORD_RESET_FROM_FORGOT_PASSWORD,
  );
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    ...defaultFormOptions,
    defaultValues: { email: "" },
    validators: {
      onDynamic: z.object({
        email: z
          .string()
          .trim()
          .email(t("auth:form.email.invalid"))
          .max(255, t("auth:form.email.invalid")),
      }),
    },

    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await requestPasswordReset({
          variables: {
            input: {
              email: value.email.trim(),
              redirectTo: `${window.location.origin}/auth/reset-password`,
            },
          },
        });

        if (!result.data?.requestPasswordReset.status) {
          throw new Error(t("auth:passwordReset.requestFailed"));
        }

        setSubmitted(true);
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              cause instanceof Error
                ? cause.message
                : t("auth:passwordReset.requestFailed"),
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
          <CardTitle>{t("auth:passwordReset.forgotTitle")}</CardTitle>
          <CardDescription>
            {submitted
              ? t("auth:passwordReset.sentDescription")
              : t("auth:passwordReset.forgotDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <MailCheck className="text-primary size-10" />
            </div>
          ) : (
            <form
              noValidate
              id="forgot-password-form"
              onSubmit={(event) => {
                void submitForm(event, form);
              }}
            >
              <FormLayout>
                <FormLayoutItem>
                  <form.Field name="email">
                    {(field) => (
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={() => handleFieldBlur(field)}
                        error={getFormErrorMessage(field.state.meta.errors)}
                        id="forgot-password-email"
                        type="email"
                        autoComplete="email"
                        label={t("auth:form.email.label")}
                        placeholder={t("auth:form.email.placeholder")}
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
          {submitted ? (
            <Button
              className="w-full"
              variant="outline"
              render={<Link to="/auth/login" />}
            >
              {t("auth:passwordReset.backToLogin")}
            </Button>
          ) : (
            <FormLayout className="w-full">
              <FormLayoutItem>
                <SubmitButton
                  formApi={form}
                  form="forgot-password-form"
                  className="w-full"
                >
                  {t("auth:passwordReset.sendLink")}
                </SubmitButton>
              </FormLayoutItem>

              <FormLayoutItem>
                <FieldDescription className="text-center">
                  <Link to="/auth/login">
                    {t("auth:passwordReset.backToLogin")}
                  </Link>
                </FieldDescription>
              </FormLayoutItem>
            </FormLayout>
          )}
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}
