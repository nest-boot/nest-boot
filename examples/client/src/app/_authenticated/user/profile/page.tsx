import { useMutation } from "@apollo/client/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { CircleX, MailCheck } from "lucide-react";
import { z } from "zod";

import { useForm } from "@tanstack/react-form";
import { useAuthUserContext } from "../../contexts/auth-user-context";
import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import {
  createUrlIdentifierSchema,
  urlIdentifierInput,
} from "@/lib/url-identifier";
import { useFormChanges } from "@/hooks/use-form-changes";

import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";

import { Page } from "@/components/thread-ui/page";
import { Input } from "@/components/thread-ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { graphql } from "@/gql";
import { SubmitButton } from "@/components/form/submit-button";
import { getFormErrorMessage } from "@/lib/form-errors";

const UPDATE_USER_FROM_USER_ROUTE = graphql(`
  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {
    updateCurrentUser(input: $input)
  }
`);

const CHANGE_EMAIL_FROM_USER_ROUTE = graphql(`
  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {
    changeCurrentUserEmail(input: $input)
  }
`);

export const Route = createFileRoute("/_authenticated/user/profile/")({
  component: UserComponent,
  beforeLoad: () => ({ title: t("user:profile.title") }),
  validateSearch: zodValidator(
    z.object({
      emailChangeCallback: z
        .union([z.literal(true), z.literal("true")])
        .optional(),
      error: z.string().optional(),
      newEmail: z.string().optional(),
    }),
  ),
});

function UserComponent() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentUser = useAuthUserContext();
  const [updateUser] = useMutation(UPDATE_USER_FROM_USER_ROUTE);
  const [changeEmail] = useMutation(CHANGE_EMAIL_FROM_USER_ROUTE);
  const search = Route.useSearch();
  const emailChangeCompleted = Boolean(
    search.emailChangeCallback &&
    search.newEmail &&
    currentUser.email === search.newEmail,
  );
  const emailChangeConfirmed = Boolean(
    search.emailChangeCallback &&
    search.newEmail &&
    !search.error &&
    !emailChangeCompleted,
  );

  const profileChanges = useFormChanges({
    name: currentUser.name.trim(),
    username: currentUser.username,
  });
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
        username: createUrlIdentifierSchema(
          t("user:profile.form.username.format"),
        ),
      }),
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      const username = value.username.trim();
      const values = { name, username };
      const input = profileChanges.getChanges(values);
      if (!Object.keys(input).length) return;

      try {
        await updateUser({
          variables: { input },
        });
        await refreshAfterMutation(() => router.invalidate());
        profileChanges.accept(values);
        form.reset(values);
        toast.add({ type: "success", title: t("user:profile.toast.updated") });
      } catch (error) {
        toast.add({
          type: "error",
          title:
            error instanceof Error
              ? error.message
              : t("user:profile.toast.update_failed"),
        });
      }
    },
  });
  const emailForm = useForm({
    ...defaultFormOptions,
    defaultValues: {
      newEmail: "",
    },
    validators: {
      onDynamic: z.object({
        newEmail: z
          .string()
          .trim()
          .email(t("user:email.form.invalid"))
          .max(255, t("user:email.form.invalid")),
      }),
    },
    onSubmit: async ({ value }) => {
      const newEmail = value.newEmail.trim().toLowerCase();

      try {
        const result = await changeEmail({
          variables: {
            input: {
              callbackURL: `${window.location.origin}/user/profile?${new URLSearchParams(
                {
                  emailChangeCallback: "true",
                  newEmail,
                },
              ).toString()}`,
              newEmail,
            },
          },
        });

        if (!result.data?.changeCurrentUserEmail) {
          throw new Error(t("user:email.toast.request_failed"));
        }

        emailForm.reset();
        toast.add({
          type: "success",
          title: t("user:email.toast.confirmation_sent"),
        });
      } catch (error) {
        toast.add({
          type: "error",
          title:
            error instanceof Error
              ? error.message
              : t("user:email.toast.request_failed"),
        });
      }
    },
  });

  return (
    <Page
      variant="compact"
      title={t("user:profile.title")}
      description={t("user:profile.description")}
    >
      <PageLayout>
        {emailChangeCompleted && !search.error && (
          <PageLayoutSection>
            <Alert>
              <MailCheck />
              <AlertTitle>{t("user:email.changed.title")}</AlertTitle>
              <AlertDescription>
                {t("user:email.changed.description")}
              </AlertDescription>
            </Alert>
          </PageLayoutSection>
        )}

        {emailChangeConfirmed && (
          <PageLayoutSection>
            <Alert>
              <MailCheck />
              <AlertTitle>{t("user:email.confirmed.title")}</AlertTitle>
              <AlertDescription>
                {t("user:email.confirmed.description", {
                  email: search.newEmail,
                })}
              </AlertDescription>
            </Alert>
          </PageLayoutSection>
        )}

        {search.error && (
          <PageLayoutSection>
            <Alert variant="destructive">
              <CircleX />
              <AlertTitle>{t("user:email.error.title")}</AlertTitle>
              <AlertDescription>
                {t("user:email.error.description")}
              </AlertDescription>
            </Alert>
          </PageLayoutSection>
        )}

        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("user:profile.card.title")}</CardTitle>
              <CardDescription>
                {t("user:profile.card.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="user-profile-form"
                noValidate
                onSubmit={(event) => {
                  void submitForm(event, form);
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={() => handleFieldBlur(field)}
                          error={getFormErrorMessage(field.state.meta.errors)}
                          id="name"
                          label={t("user:profile.form.name.label")}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <form.Field name="username">
                      {(field) => (
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={() => handleFieldBlur(field)}
                          error={getFormErrorMessage(field.state.meta.errors)}
                          id="username"
                          label={t("user:profile.form.username.label")}
                          title={t("user:profile.form.username.format")}
                          required
                          placeholder="alice"
                          {...urlIdentifierInput}
                          autoComplete="username"
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <SubmitButton
                formApi={form}
                form="user-profile-form"
                requireDirty
              >
                {t("action.save")}
              </SubmitButton>
            </CardFooter>
          </Card>
        </PageLayoutSection>

        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("user:email.card.title")}</CardTitle>
              <CardDescription>
                {t("user:email.card.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="user-email-form"
                noValidate
                onSubmit={(event) => {
                  void submitForm(event, emailForm);
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <Input
                      id="current-email"
                      label={t("user:email.form.current_email")}
                      value={currentUser.email}
                      disabled
                    />
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <emailForm.Field name="newEmail">
                      {(field) => (
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={() => handleFieldBlur(field)}
                          error={getFormErrorMessage(field.state.meta.errors)}
                          id="new-email"
                          type="email"
                          autoComplete="email"
                          label={t("user:email.form.new_email")}
                        />
                      )}
                    </emailForm.Field>
                  </FormLayoutItem>
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <SubmitButton
                formApi={emailForm}
                form="user-email-form"
                requireDirty
              >
                {t("user:email.form.submit")}
              </SubmitButton>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
