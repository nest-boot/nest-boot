import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { t } from "i18next";
import { zodValidator } from "@tanstack/zod-adapter";
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

const RESET_PASSWORD_FROM_RESET_PASSWORD = graphql(`
  mutation resetPasswordFromResetPassword($input: AuthResetPasswordInput!) {
    authResetPassword(input: $input)
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
  const search = useSearch({ from: "/auth/reset-password/" });
  const [resetPassword] = useMutation(RESET_PASSWORD_FROM_RESET_PASSWORD);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const invalidToken = Boolean(search.error || !search.token);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const parsed = createResetPasswordSchema().safeParse({
      confirmPassword,
      newPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    if (!search.token) return;

    setLoading(true);
    try {
      const result = await resetPassword({
        variables: {
          input: {
            newPassword: parsed.data.newPassword,
            token: search.token,
          },
        },
      });

      if (!result.data?.authResetPassword) {
        throw new Error(t("auth:passwordReset.resetFailed"));
      }

      setCompleted(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("auth:passwordReset.resetFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

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
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup className="gap-4">
                <Input
                  id="reset-password-new"
                  data-testid="reset-password-new"
                  type="password"
                  autoComplete="new-password"
                  label={t("auth:passwordReset.newPassword")}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError(undefined);
                  }}
                />
                <Input
                  id="reset-password-confirm"
                  data-testid="reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  label={t("auth:passwordReset.confirmPassword")}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(undefined);
                  }}
                />

                {error && (
                  <FieldDescription className="text-destructive">
                    {error}
                  </FieldDescription>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  data-testid="reset-password-submit"
                  loading={loading}
                >
                  {t("auth:passwordReset.resetSubmit")}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
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
