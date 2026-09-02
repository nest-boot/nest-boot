import { useMemo, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useSearch } from "@tanstack/react-router";
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
import { authClient } from "@/lib/auth-client";

const INVITE_TOKEN_KEY = "workspace_invite_token";
const DEFAULT_REDIRECT = "/workspaces";

type AuthMode = "login" | "register";

interface AuthFormValues {
  email: string;
  name: string;
  password: string;
}

type AuthFormErrors = Partial<Record<keyof AuthFormValues | "form", string>>;

export function LoginForm({
  className,
  ...props
}: Omit<ComponentProps<"div">, "ref">) {
  const apolloClient = useApolloClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState<AuthFormValues>({
    email: "",
    name: "",
    password: "",
  });
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [loading, setLoading] = useState(false);
  const redirect = useSearch({
    from: "/auth/login/",
    select: (search) => search.redirect,
  });

  const submitLabel = useMemo(
    () =>
      mode === "login"
        ? t("auth:form.loginSubmit")
        : t("auth:form.registerSubmit"),
    [mode],
  );

  const handleOidcLogin = () => {
    // 检查是否有邀请 token（在用户交互时访问，此时肯定在客户端）
    const inviteToken =
      typeof window !== "undefined"
        ? localStorage.getItem(INVITE_TOKEN_KEY)
        : null;

    // 如果有邀请 token，登录成功后跳转到接受邀请页面
    // 使用 tanstack router 的方式构建 URL
    const callbackURL = resolvePostAuthUrl(redirect, inviteToken);

    authClient.signIn.oauth2({
      providerId: "oidc",
      callbackURL,
    });
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
        const result = await authClient.signIn.email({
          email: input.email,
          password: input.password,
        });

        if (result.error) {
          throw new Error(result.error.message ?? t("auth:form.authFailed"));
        }
      } else {
        const input = registerSchema.parse(values);
        const result = await authClient.signUp.email({
          email: input.email,
          name: input.name,
          password: input.password,
        });

        if (result.error) {
          throw new Error(result.error.message ?? t("auth:form.authFailed"));
        }
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
            onValueChange={(value) => {
              setMode(value as AuthMode);
              setErrors({});
            }}
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

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  {t("auth:form.or")}
                </FieldSeparator>

                <Field>
                  <Button
                    className="w-full"
                    variant="outline"
                    type="button"
                    onClick={handleOidcLogin}
                    disabled={loading}
                  >
                    <ShieldCheck />
                    {t("auth:loginWithOIDC")}
                  </Button>
                </Field>
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
  });
}

function createRegisterSchema(
  loginSchema: ReturnType<typeof createLoginSchema>,
) {
  return loginSchema.extend({
    name: z.string().trim().min(1, t("auth:form.name.required")),
  });
}

function resolvePostAuthUrl(redirect?: string, inviteToken?: string | null) {
  const storedInviteToken =
    inviteToken ??
    (typeof window !== "undefined"
      ? localStorage.getItem(INVITE_TOKEN_KEY)
      : null);

  if (storedInviteToken) {
    return `/invite?token=${encodeURIComponent(storedInviteToken)}`;
  }

  if (!redirect || typeof window === "undefined") {
    return DEFAULT_REDIRECT;
  }

  if (redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }

  try {
    const url = new URL(redirect);

    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return DEFAULT_REDIRECT;
  }

  return DEFAULT_REDIRECT;
}
