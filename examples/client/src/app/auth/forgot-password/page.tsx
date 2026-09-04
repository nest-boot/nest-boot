import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { t } from "i18next";
import { z } from "zod";

import { AuthPageShell } from "../components/auth-page-shell";
import type { FormEvent } from "react";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { graphql } from "@/gql";

const REQUEST_PASSWORD_RESET_FROM_FORGOT_PASSWORD = graphql(`
  mutation requestPasswordResetFromForgotPassword(
    $input: AuthRequestPasswordResetInput!
  ) {
    authRequestPasswordReset(input: $input) {
      status
    }
  }
`);

export const Route = createFileRoute("/auth/forgot-password/")({
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const [requestPasswordReset] = useMutation(
    REQUEST_PASSWORD_RESET_FROM_FORGOT_PASSWORD,
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const parsed = z
      .string()
      .email(t("auth:form.email.invalid"))
      .safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset({
        variables: {
          input: {
            email: parsed.data,
            redirectTo: `${window.location.origin}/auth/reset-password`,
          },
        },
      });

      if (!result.data?.authRequestPasswordReset.status) {
        throw new Error(t("auth:passwordReset.requestFailed"));
      }

      setSubmitted(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("auth:passwordReset.requestFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <Card data-testid="forgot-password-view">
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
              <Button
                className="w-full"
                variant="outline"
                render={<Link to="/auth/login" />}
              >
                {t("auth:passwordReset.backToLogin")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup className="gap-4">
                <Input
                  id="forgot-password-email"
                  data-testid="forgot-password-email"
                  type="email"
                  autoComplete="email"
                  label={t("auth:form.email.label")}
                  placeholder={t("auth:form.email.placeholder")}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(undefined);
                  }}
                  error={error}
                />

                <Button
                  type="submit"
                  className="w-full"
                  data-testid="forgot-password-submit"
                  loading={loading}
                >
                  {t("auth:passwordReset.sendLink")}
                </Button>

                <FieldDescription className="text-center">
                  <Link to="/auth/login">
                    {t("auth:passwordReset.backToLogin")}
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
