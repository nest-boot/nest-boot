import { useId, useMemo, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ComponentProps } from "react";
import { getFormErrorMessage } from "@/lib/form-errors";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { toast } from "@/components/thread-ui/toast";

import { cn } from "@/lib/utils";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createEmailVerificationCallbackUrl,
  createEmailVerificationPagePath,
  resolvePostAuthPath,
} from "@/lib/auth-redirect";
import { graphql } from "@/gql";

const AUTH_SIGN_IN_FROM_LOGIN_FORM = graphql(`
  mutation signInFromLoginForm($input: AuthSignInInput!) {
    signIn(input: $input) {
      user {
        id
      }
    }
  }
`);

const AUTH_SIGN_UP_FROM_LOGIN_FORM = graphql(`
  mutation signUpFromLoginForm($input: AuthSignUpInput!) {
    signUp(input: $input) {
      id
    }
  }
`);

const GET_SOCIAL_PROVIDERS_FROM_LOGIN_FORM = graphql(`
  query getSocialProvidersFromLoginForm {
    socialProviders {
      id
      name
    }
  }
`);

const AUTH_SIGN_IN_SOCIAL_FROM_LOGIN_FORM = graphql(`
  mutation signInSocialFromLoginForm($input: AuthSignInSocialInput!) {
    signInSocial(input: $input) {
      redirect
      url
    }
  }
`);

const INVITATION_ID_KEY = "invitation_id";

type AuthMode = "login" | "register";

export function LoginForm({
  className,
  mode,
  redirect,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  mode: AuthMode;
  redirect?: string;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const apolloClient = useApolloClient();
  const navigate = useNavigate();
  const [signIn] = useMutation(AUTH_SIGN_IN_FROM_LOGIN_FORM);
  const [signUp] = useMutation(AUTH_SIGN_UP_FROM_LOGIN_FORM);
  const [signInSocial] = useMutation(AUTH_SIGN_IN_SOCIAL_FROM_LOGIN_FORM);
  const { data: socialProviderData } = useQuery(
    GET_SOCIAL_PROVIDERS_FROM_LOGIN_FORM,
  );
  const [socialProviderId, setSocialProviderId] = useState<string>();
  const socialProviders = socialProviderData?.socialProviders ?? [];
  const submitLabel = useMemo(
    () =>
      mode === "login"
        ? t("auth:form.loginSubmit")
        : t("auth:form.registerSubmit"),
    [mode, t],
  );

  const handleSocialLogin = async (provider: { id: string; name: string }) => {
    form.setErrorMap({ onSubmit: undefined });
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
      const url = result.data?.signInSocial.url;
      if (!url) throw new Error(t("auth:form.authFailed"));

      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth:form.authFailed");
      form.setErrorMap({ onSubmit: { form: message, fields: {} } });
      toast.add({ type: "error", title: message });
      setSocialProviderId(undefined);
    }
  };

  const schema =
    mode === "login"
      ? createLoginSchema()
      : createRegisterSchema(createLoginSchema());
  const form = useForm({
    defaultValues: { email: "", name: "", password: "", rememberMe: true },
    validators: { onSubmit: schema },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        if (mode === "login") {
          const input = createLoginSchema().parse(value);
          const result = await signIn({
            variables: {
              input: {
                email: input.email,
                password: input.password,
                rememberMe: input.rememberMe,
              },
            },
          });

          if (!result.data?.signIn.user.id) {
            throw new Error(t("auth:form.authFailed"));
          }
        } else {
          const input = createRegisterSchema(createLoginSchema()).parse(value);
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

          if (!result.data?.signUp.id) {
            throw new Error(t("auth:form.authFailed"));
          }

          await apolloClient.clearStore();
          window.location.assign(
            createEmailVerificationPagePath(input.email, postAuthPath),
          );
          return;
        }

        await apolloClient.clearStore();
        toast.add({
          type: "success",
          title:
            mode === "login"
              ? t("auth:form.loginSuccess")
              : t("auth:form.registerSuccess"),
        });
        window.location.assign(resolvePostAuthUrl(redirect));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("auth:form.authFailed");

        formApi.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.add({ type: "error", title: message });
      }
    },
  });
  const loading = useStore(form.store, (state) => state.isSubmitting);
  const formError = useStore(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t("auth:welcomeBack")}</CardTitle>
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
              <TabsTrigger value="login">
                <LogIn />
                {t("auth:form.loginTab")}
              </TabsTrigger>
              <TabsTrigger value="register">
                <UserPlus />
                {t("auth:form.registerTab")}
              </TabsTrigger>
            </TabsList>

            <form
              noValidate
              id={formId}
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (form.state.isSubmitting) return;
                form.setErrorMap({ onSubmit: undefined });
                form.handleSubmit();
              }}
              className="mt-6"
            >
              <FormLayout>
                {mode === "register" && (
                  <FormLayoutItem>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          id="name"
                          autoComplete="name"
                          label={t("auth:form.name.label")}
                          placeholder={t("auth:form.name.placeholder")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                )}

                <FormLayoutItem>
                  <form.Field name="email">
                    {(field) => (
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        label={t("auth:form.email.label")}
                        placeholder={t("auth:form.email.placeholder")}
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
                  <form.Field name="password">
                    {(field) => (
                      <Input
                        id="password"
                        type="password"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        label={t("auth:form.password.label")}
                        placeholder={t("auth:form.password.placeholder")}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        error={getFormErrorMessage(field.state.meta.errors)}
                      />
                    )}
                  </form.Field>
                </FormLayoutItem>

                {mode === "login" && (
                  <FormLayoutItem>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div>
                        <Field orientation="horizontal">
                          <form.Field name="rememberMe">
                            {(field) => (
                              <Checkbox
                                id="remember-me"
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                              />
                            )}
                          </form.Field>
                          <FieldLabel htmlFor="remember-me">
                            {t("auth:form.rememberMe")}
                          </FieldLabel>
                        </Field>
                      </div>

                      <Link
                        to="/auth/forgot-password"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {t("auth:form.forgotPassword")}
                      </Link>
                    </div>
                  </FormLayoutItem>
                )}

                {formError && (
                  <FormLayoutItem>
                    <FieldError>{formError}</FieldError>
                  </FormLayoutItem>
                )}
              </FormLayout>
            </form>
          </Tabs>
        </CardContent>
        <CardFooter>
          <FormLayout className="w-full">
            <FormLayoutItem>
              <Button
                type="submit"
                form={formId}
                className="w-full"
                loading={loading}
              >
                {mode === "login" ? <LogIn /> : <UserPlus />}
                {submitLabel}
              </Button>
            </FormLayoutItem>

            {socialProviders.length > 0 && (
              <>
                <FormLayoutItem>
                  <FieldSeparator>{t("auth:form.or")}</FieldSeparator>
                </FormLayoutItem>

                {socialProviders.map((provider) => (
                  <FormLayoutItem key={provider.id}>
                    <Button
                      className="w-full"
                      variant="outline"
                      type="button"
                      onClick={() => handleSocialLogin(provider)}
                      disabled={loading || socialProviderId !== undefined}
                      loading={socialProviderId === provider.id}
                    >
                      <ShieldCheck />
                      {t("auth:continueWithProvider", {
                        provider: provider.name,
                      })}
                    </Button>
                  </FormLayoutItem>
                ))}
              </>
            )}
          </FormLayout>
        </CardFooter>
      </Card>
      <div className="px-6">
        <FieldDescription className="text-center">
          {t("auth:byClickingContinue")}{" "}
          <a href="#">{t("auth:termsOfService")}</a> {t("auth:and")}{" "}
          <a href="#">{t("auth:privacyPolicy")}</a>.
        </FieldDescription>
      </div>
    </div>
  );
}

function createLoginSchema() {
  return z.object({
    name: z.string(),
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
