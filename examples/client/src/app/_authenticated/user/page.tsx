import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { t } from "i18next";
import { CircleX, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { graphql } from "@/gql";

const GET_CURRENT_USER_FROM_USER_ROUTE = graphql(`
  query getCurrentUserFromUserRoute {
    currentUser {
      id
      name
      email
      createdAt
    }
  }
`);

const UPDATE_USER_FROM_USER_ROUTE = graphql(`
  mutation updateUserFromUserRoute($input: AuthUpdateUserInput!) {
    authUpdateUser(input: $input)
  }
`);

const CHANGE_EMAIL_FROM_USER_ROUTE = graphql(`
  mutation changeEmailFromUserRoute($input: AuthChangeEmailInput!) {
    authChangeEmail(input: $input)
  }
`);

export const Route = createFileRoute("/_authenticated/user/")({
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
  const { data, refetch } = useSuspenseQuery(GET_CURRENT_USER_FROM_USER_ROUTE);
  const [updateUser] = useMutation(UPDATE_USER_FROM_USER_ROUTE);
  const [changeEmail] = useMutation(CHANGE_EMAIL_FROM_USER_ROUTE);
  const search = Route.useSearch();
  const emailChangeCompleted = Boolean(
    search.emailChangeCallback &&
    search.newEmail &&
    data.currentUser.email === search.newEmail,
  );
  const emailChangeConfirmed = Boolean(
    search.emailChangeCallback &&
    search.newEmail &&
    !search.error &&
    !emailChangeCompleted,
  );

  const form = useForm({
    defaultValues: {
      name: data.currentUser.name,
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();

      try {
        await updateUser({ variables: { input: { name } } });
        await refetch();
        form.reset({ name });
        toast.success(t("user:profile.toast.updated"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("user:profile.toast.update_failed"),
        );
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
              callbackURL: `${window.location.origin}/user?${new URLSearchParams(
                {
                  emailChangeCallback: "true",
                  newEmail,
                },
              ).toString()}`,
              newEmail,
            },
          },
        });

        if (!result.data?.authChangeEmail) {
          throw new Error(t("user:email.toast.request_failed"));
        }

        emailForm.reset();
        toast.success(t("user:email.toast.confirmation_sent"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("user:email.toast.request_failed"),
        );
      }
    },
  });

  return (
    <Page data-testid="user-profile-page">
      <PageHeader>
        <PageTitle>{t("user:profile.title")}</PageTitle>
        <PageDescription>{t("user:profile.description")}</PageDescription>
      </PageHeader>

      <PageContent>
        {emailChangeCompleted && !search.error && (
          <Alert data-testid="user-email-changed-alert">
            <MailCheck />
            <AlertTitle>{t("user:email.changed.title")}</AlertTitle>
            <AlertDescription>
              {t("user:email.changed.description")}
            </AlertDescription>
          </Alert>
        )}

        {emailChangeConfirmed && (
          <Alert data-testid="user-email-confirmed-alert">
            <MailCheck />
            <AlertTitle>{t("user:email.confirmed.title")}</AlertTitle>
            <AlertDescription>
              {t("user:email.confirmed.description", {
                email: search.newEmail,
              })}
            </AlertDescription>
          </Alert>
        )}

        {search.error && (
          <Alert variant="destructive" data-testid="user-email-error-alert">
            <CircleX />
            <AlertTitle>{t("user:email.error.title")}</AlertTitle>
            <AlertDescription>
              {t("user:email.error.description")}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("user:profile.card.title")}</CardTitle>
            <CardDescription>
              {t("user:profile.card.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
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
                        error={field.state.meta.errors.join(", ") || undefined}
                      />
                    )}
                  </form.Field>

                  <Input
                    id="email"
                    label={t("user:profile.form.email.label")}
                    value={data.currentUser.email}
                    disabled
                  />

                  <Field orientation="horizontal">
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
                          data-testid="user-profile-save"
                          disabled={!isDirty || !canSubmit}
                          loading={isSubmitting}
                        >
                          {t("action.save")}
                        </Button>
                      )}
                    </form.Subscribe>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("user:email.card.title")}</CardTitle>
            <CardDescription>
              {t("user:email.card.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
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
                    value={data.currentUser.email}
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
                        error={field.state.meta.errors.join(", ") || undefined}
                      />
                    )}
                  </emailForm.Field>

                  <Field orientation="horizontal">
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
                          data-testid="user-change-email-submit"
                          disabled={!isDirty || !canSubmit}
                          loading={isSubmitting}
                        >
                          {t("user:email.form.submit")}
                        </Button>
                      )}
                    </emailForm.Subscribe>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </form>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
