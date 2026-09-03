import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { CircleCheck, CircleX, MailCheck, RotateCw } from "lucide-react";
import { t } from "i18next";
import { z } from "zod";

import { AuthPageShell } from "../components/auth-page-shell";
import { Button } from "@/components/thread-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { graphql } from "@/gql";
import { createEmailVerificationCallbackUrl } from "@/lib/auth-redirect";

const SEND_VERIFICATION_EMAIL_FROM_VERIFY_EMAIL = graphql(`
  mutation sendVerificationEmailFromVerifyEmail(
    $input: AuthSendVerificationEmailInput!
  ) {
    authSendVerificationEmail(input: $input)
  }
`);

export const Route = createFileRoute("/auth/verify-email/")({
  component: VerifyEmailComponent,
  validateSearch: zodValidator(
    z.object({
      email: z.string().optional(),
      error: z.string().optional(),
      redirect: z.string().optional(),
      verified: z.union([z.literal(true), z.literal("true")]).optional(),
    }),
  ),
});

function VerifyEmailComponent() {
  const search = Route.useSearch();
  const [sendVerificationEmail] = useMutation(
    SEND_VERIFICATION_EMAIL_FROM_VERIFY_EMAIL,
  );
  const [error, setError] = useState<string>();
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const redirect = normalizeRedirect(search.redirect);
  const loginUrl = `/auth/login?${new URLSearchParams({ redirect }).toString()}`;
  const invalid = Boolean(search.error);
  const verified = Boolean(search.verified && !invalid);

  const resend = async () => {
    if (!search.email) return;

    setError(undefined);
    setLoading(true);
    try {
      const result = await sendVerificationEmail({
        variables: {
          input: {
            callbackURL: createEmailVerificationCallbackUrl(
              window.location.origin,
              redirect,
            ),
            email: search.email,
          },
        },
      });

      if (!result.data?.authSendVerificationEmail) {
        throw new Error(t("auth:emailVerification.resendFailed"));
      }
      setResent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("auth:emailVerification.resendFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <Card data-testid="verify-email-view">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            {invalid ? (
              <CircleX className="text-destructive size-10" />
            ) : verified ? (
              <CircleCheck className="text-primary size-10" />
            ) : (
              <MailCheck className="text-primary size-10" />
            )}
          </div>
          <CardTitle>
            {invalid
              ? t("auth:emailVerification.invalidTitle")
              : verified
                ? t("auth:emailVerification.verifiedTitle")
                : t("auth:emailVerification.pendingTitle")}
          </CardTitle>
          <CardDescription>
            {invalid
              ? t("auth:emailVerification.invalidDescription")
              : verified
                ? t("auth:emailVerification.verifiedDescription")
                : t("auth:emailVerification.pendingDescription", {
                    email: search.email,
                  })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {resent && (
            <FieldDescription
              className="text-center"
              data-testid="verify-email-resent"
            >
              {t("auth:emailVerification.resent")}
            </FieldDescription>
          )}
          {error && (
            <FieldDescription className="text-destructive text-center">
              {error}
            </FieldDescription>
          )}

          {verified ? (
            <Button
              className="w-full"
              render={<a href={loginUrl} />}
              data-testid="verify-email-sign-in"
            >
              {t("auth:emailVerification.signIn")}
            </Button>
          ) : search.email ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={resend}
              loading={loading}
              data-testid="verify-email-resend"
            >
              <RotateCw />
              {t("auth:emailVerification.resend")}
            </Button>
          ) : (
            <Button
              className="w-full"
              variant="outline"
              render={<a href={loginUrl} />}
            >
              {t("auth:emailVerification.backToSignIn")}
            </Button>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

function normalizeRedirect(redirect?: string): string {
  if (redirect?.startsWith("/") && !redirect.startsWith("//")) return redirect;
  return "/workspaces";
}
