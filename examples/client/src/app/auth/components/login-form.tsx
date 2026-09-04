import { useMemo, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { t } from "i18next";
import { toast } from "sonner";
import { z } from "zod";
import type { ChangeEvent, ComponentProps, FormEvent } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  createEmailVerificationCallbackUrl,
  createEmailVerificationPagePath,
  resolvePostAuthPath,
} from "@/lib/auth-redirect";
import { graphql } from "@/gql";

const AUTH_SIGN_IN_FROM_LOGIN_FORM = graphql(`
  mutation authSignInFromLoginForm($input: AuthSignInInput!) {
    authSignIn(input: $input) {
      user {
        id
      }
    }
  }
`);

const AUTH_SIGN_UP_FROM_LOGIN_FORM = graphql(`
  mutation authSignUpFromLoginForm($input: AuthSignUpInput!) {
    authSignUp(input: $input) {
      user {
        id
      }
    }
  }
`);

const GET_SOCIAL_PROVIDERS_FROM_LOGIN_FORM = graphql(`
  query getSocialProvidersFromLoginForm {
    authSocialProviders {
      id
      name
    }
  }
`);

const AUTH_SIGN_IN_SOCIAL_FROM_LOGIN_FORM = graphql(`
  mutation authSignInSocialFromLoginForm($input: AuthSignInSocialInput!) {
    authSignInSocial(input: $input) {
      redirect
      url
    }
  }
`);

const INVITATION_ID_KEY = "workspace_invitation_id";

type AuthMode = "login" | "register";

interface AuthFormValues {
  email: string;
  name: string;
  password: string;
  rememberMe: boolean;
}

type AuthFormErrors = Partial<Record<keyof AuthFormValues | "form", string>>;

export function LoginForm({
  className,
  mode,
  redirect,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  mode: AuthMode;
  redirect?: string;
}) {
  const apolloClient = useApolloClient();
  const navigate = useNavigate();
  const [signIn] = useMutation(AUTH_SIGN_IN_FROM_LOGIN_FORM);
  const [signUp] = useMutation(AUTH_SIGN_UP_FROM_LOGIN_FORM);
  const [signInSocial] = useMutation(AUTH_SIGN_IN_SOCIAL_FROM_LOGIN_FORM);
  const { data: socialProviderData } = useQuery(
    GET_SOCIAL_PROVIDERS_FROM_LOGIN_FORM,
  );
  const [values, setValues] = useState<AuthFormValues>({
    email: "",
    name: "",
    password: "",
    rememberMe: true,
  });
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [socialProviderId, setSocialProviderId] = useState<string>();
  const socialProviders = socialProviderData?.authSocialProviders ?? [];
  const submitLabel = useMemo(
    () =>
      mode === "login"
        ? t("auth:form.loginSubmit")
        : t("auth:form.registerSubmit"),
    [mode],
  );

  const handleSocialLogin = async (provider: { id: string; name: string }) => {
    setErrors((current) => ({ ...current, form: undefined }));
    setSocialProviderId(provider.id);

    try {
      const callbackURL = new URL(
        resolvePostAuthUrl(redirect),
        window.location.origin,
      ).toString();
      const errorCallbackURL = new URL(
        mode === "register" ? "/auth/register" : "/auth/login",
        window.location.origin,
      );
      if (redirect) errorCallbackURL.searchParams.set("redirect", redirect);

      const result = await signInSocial({
        variables: {
          input: {
            callbackURL,
            errorCallbackURL: errorCallbackURL.toString(),
            newUserCallbackURL: callbackURL,
            provider: provider.id,
            requestSignUp: mode === "register" ? true : undefined,
          },
        },
      });
      const url = result.data?.authSignInSocial.url;
      if (!url) throw new Error(t("auth:form.authFailed"));

      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth:form.authFailed");
      setErrors((current) => ({ ...current, form: message }));
      toast.error(message);
      setSocialProviderId(undefined);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const loginSchema = createLoginSchema();
    const registerSchema = createRegisterSchema(loginSchema);
    const parsed =
      mode === "login"
        ? loginSchema.safeParse(values)
        : registerSchema.safeParse(values);

    if (!parsed.success) {
      setErrors(
        parsed.error.issues.reduce<AuthFormErrors>((nextErrors, issue) => {
          const field = issue.path[0] as keyof AuthFormValues | undefined;

          if (field && !nextErrors[field]) {
            nextErrors[field] = issue.message;
          }

          return nextErrors;
        }, {}),
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const input = loginSchema.parse(values);
        const result = await signIn({
          variables: {
            input: {
              email: input.email,
              password: input.password,
              rememberMe: input.rememberMe,
            },
          },
        });

        if (!result.data?.authSignIn.user.id) {
          throw new Error(t("auth:form.authFailed"));
        }
      } else {
        const input = registerSchema.parse(values);
        const postAuthPath = resolvePostAuthUrl(redirect);
        const result = await signUp({
          variables: {
            input: {
              callbackURL: createEmailVerificationCallbackUrl(
                window.location.origin,
                postAuthPath,
              ),
              email: input.email,
              name: input.name,
              password: input.password,
            },
          },
        });

        if (!result.data?.authSignUp.user.id) {
          throw new Error(t("auth:form.authFailed"));
        }

        await apolloClient.clearStore();
        window.location.assign(
          createEmailVerificationPagePath(input.email, postAuthPath),
        );
        return;
      }

      await apolloClient.clearStore();
      toast.success(
        mode === "login"
          ? t("auth:form.loginSuccess")
          : t("auth:form.registerSuccess"),
      );
      window.location.assign(resolvePostAuthUrl(redirect));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth:form.authFailed");

      setErrors({ form: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateValue =
    (name: keyof AuthFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        [name]: event.target.value,
      }));
      setErrors((current) => ({
        ...current,
        [name]: undefined,
        form: undefined,
      }));
    };

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      data-testid="auth-view"
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("auth:welcomeBack")}</CardTitle>
          <CardDescription>{t("auth:emailAuthDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(value) =>
              navigate({
                to: value === "register" ? "/auth/register" : "/auth/login",
                search: redirect ? { redirect } : {},
              })
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="auth-tab-login">
                <LogIn />
                {t("auth:form.loginTab")}
              </TabsTrigger>
              <TabsTrigger value="register" data-testid="auth-tab-register">
                <UserPlus />
                {t("auth:form.registerTab")}
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-6">
              <FieldGroup className="gap-4">
                {mode === "register" && (
                  <Input
                    id="name"
                    data-testid="auth-name-input"
                    autoComplete="name"
                    label={t("auth:form.name.label")}
                    placeholder={t("auth:form.name.placeholder")}
                    value={values.name}
                    onChange={updateValue("name")}
                    error={errors.name}
                  />
                )}

                <Input
                  id="email"
                  data-testid="auth-email-input"
                  type="email"
                  autoComplete="email"
                  label={t("auth:form.email.label")}
                  placeholder={t("auth:form.email.placeholder")}
                  value={values.email}
                  onChange={updateValue("email")}
                  error={errors.email}
                />

                <Input
                  id="password"
                  data-testid="auth-password-input"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  label={t("auth:form.password.label")}
                  placeholder={t("auth:form.password.placeholder")}
                  value={values.password}
                  onChange={updateValue("password")}
                  error={errors.password}
                />

                {mode === "login" && (
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember-me"
                        data-testid="auth-remember-me"
                        checked={values.rememberMe}
                        onCheckedChange={(checked) =>
                          setValues((current) => ({
                            ...current,
                            rememberMe: checked,
                          }))
                        }
                      />
                      <Label htmlFor="remember-me">
                        {t("auth:form.rememberMe")}
                      </Label>
                    </div>

                    <Link
                      to="/auth/forgot-password"
                      className="text-primary underline-offset-4 hover:underline"
                      data-testid="auth-forgot-password-link"
                    >
                      {t("auth:form.forgotPassword")}
                    </Link>
                  </div>
                )}

                {errors.form && (
                  <FieldDescription className="text-destructive">
                    {errors.form}
                  </FieldDescription>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  data-testid="auth-submit"
                  loading={loading}
                >
                  {mode === "login" ? <LogIn /> : <UserPlus />}
                  {submitLabel}
                </Button>

                {socialProviders.length > 0 && (
                  <>
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                      {t("auth:form.or")}
                    </FieldSeparator>

                    {socialProviders.map((provider) => (
                      <Field key={provider.id}>
                        <Button
                          className="w-full"
                          variant="outline"
                          type="button"
                          onClick={() => handleSocialLogin(provider)}
                          disabled={loading || socialProviderId !== undefined}
                          loading={socialProviderId === provider.id}
                          data-testid={`auth-social-submit-${provider.id}`}
                        >
                          <ShieldCheck />
                          {t("auth:continueWithProvider", {
                            provider: provider.name,
                          })}
                        </Button>
                      </Field>
                    ))}
                  </>
                )}
              </FieldGroup>
            </form>
          </Tabs>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        {t("auth:byClickingContinue")}{" "}
        <a href="#">{t("auth:termsOfService")}</a> {t("auth:and")}{" "}
        <a href="#">{t("auth:privacyPolicy")}</a>.
      </FieldDescription>
    </div>
  );
}

function createLoginSchema() {
  return z.object({
    email: z.string().email(t("auth:form.email.invalid")),
    password: z.string().min(8, t("auth:form.password.min")),
    rememberMe: z.boolean(),
  });
}

function createRegisterSchema(
  loginSchema: ReturnType<typeof createLoginSchema>,
) {
  return loginSchema.extend({
    name: z.string().trim().min(1, t("auth:form.name.required")),
  });
}

function resolvePostAuthUrl(redirect?: string, invitationId?: string | null) {
  const storedInvitationId =
    invitationId ??
    (typeof window !== "undefined"
      ? localStorage.getItem(INVITATION_ID_KEY)
      : null);

  return resolvePostAuthPath(
    redirect,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
    storedInvitationId,
  );
}
