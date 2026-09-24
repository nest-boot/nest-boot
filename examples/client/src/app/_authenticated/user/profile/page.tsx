import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { CircleX, MailCheck } from "lucide-react";
import { z } from "zod";

import { useCurrentUserContext } from "../../contexts/current-user-context";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import { Button } from "@/components/thread-ui/button";
import {
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
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
import { FieldGroup, FieldSet } from "@/components/ui/field";
import { graphql } from "@/gql";

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
  const currentUser = useCurrentUserContext();
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

  const form = useForm({
    defaultValues: {
      name: currentUser.name,
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();

      try {
        await updateUser({ variables: { input: { name } } });
        await router.invalidate();
        form.reset({ name });
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
    defaultValues: {
      newEmail: "",
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
    <Page variant="compact" data-testid="user-profile-page">
      <PageHeader>
        <PageTitle>{t("user:profile.title")}</PageTitle>
        <PageDescription>{t("user:profile.description")}</PageDescription>
      </PageHeader>

      <PageContent>
        <PageLayout>
          {emailChangeCompleted && !search.error && (
            <PageLayoutSection>
              <Alert data-testid="user-email-changed-alert">
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
              <Alert data-testid="user-email-confirmed-alert">
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
              <Alert variant="destructive" data-testid="user-email-error-alert">
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
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    form.handleSubmit();
                  }}
                >
                  <FieldSet>
                    <FieldGroup>
                      <form.Field
                        name="name"
                        validators={{
                          onChange: ({ value }) =>
                            value.trim()
                              ? undefined
                              : t("user:profile.form.name.required"),
                        }}
                      >
                        {(field) => (
                          <Input
                            id="name"
                            data-testid="user-profile-name-input"
                            label={t("user:profile.form.name.label")}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            error={
                              field.state.meta.errors.join(", ") || undefined
                            }
                          />
                        )}
                      </form.Field>
                    </FieldGroup>
                  </FieldSet>
                </form>
              </CardContent>
              <CardFooter>
                <form.Subscribe
                  selector={(state) => [
                    state.isDirty,
                    state.isSubmitting,
                    state.canSubmit,
                  ]}
                >
                  {([isDirty, isSubmitting, canSubmit]) => (
                    <Button
                      type="submit"
                      form="user-profile-form"
                      data-testid="user-profile-save"
                      disabled={!isDirty || !canSubmit}
                      loading={isSubmitting}
                    >
                      {t("action.save")}
                    </Button>
                  )}
                </form.Subscribe>
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
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    emailForm.handleSubmit();
                  }}
                >
                  <FieldSet>
                    <FieldGroup>
                      <Input
                        id="current-email"
                        data-testid="user-current-email"
                        label={t("user:email.form.current_email")}
                        value={currentUser.email}
                        disabled
                      />

                      <emailForm.Field
                        name="newEmail"
                        validators={{
                          onChange: ({ value }) =>
                            z.string().email().safeParse(value.trim()).success
                              ? undefined
                              : t("user:email.form.invalid"),
                        }}
                      >
                        {(field) => (
                          <Input
                            id="new-email"
                            data-testid="user-new-email-input"
                            type="email"
                            autoComplete="email"
                            label={t("user:email.form.new_email")}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            error={
                              field.state.meta.errors.join(", ") || undefined
                            }
                          />
                        )}
                      </emailForm.Field>
                    </FieldGroup>
                  </FieldSet>
                </form>
              </CardContent>
              <CardFooter>
                <emailForm.Subscribe
                  selector={(state) => [
                    state.isDirty,
                    state.isSubmitting,
                    state.canSubmit,
                  ]}
                >
                  {([isDirty, isSubmitting, canSubmit]) => (
                    <Button
                      type="submit"
                      form="user-email-form"
                      data-testid="user-change-email-submit"
                      disabled={!isDirty || !canSubmit}
                      loading={isSubmitting}
                    >
                      {t("user:email.form.submit")}
                    </Button>
                  )}
                </emailForm.Subscribe>
              </CardFooter>
            </Card>
          </PageLayoutSection>
        </PageLayout>
      </PageContent>
    </Page>
  );
}
