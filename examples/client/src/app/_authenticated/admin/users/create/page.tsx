import { useId } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Link } from "@/components/link";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { adminUserSearchSchema } from "@/schemas/admin-user-search-schema";
import { adminUsersResourceKey } from "@/lib/resource-keys";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";
import { getFormErrorMessage } from "@/lib/form-errors";

const CREATE_USER_FROM_CREATE_USER_ROUTE = graphql(`
  mutation createUserFromCreateUserRoute($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/admin/users/create/")({
  component: CreateUserPage,
  beforeLoad: ({ context }) => {
    if (!context.ability.can("create", "User"))
      throw redirect({ to: "/admin/users" });
    return { title: t("admin:users.create.title") };
  },
});

function CreateUserPage() {
  const { t } = useTranslation();
  const formId = useId();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...adminUsersResourceKey],
    searchSchema: adminUserSearchSchema,
  });
  const navigate = useNavigate();
  const ability = useAbility();
  const canCreate = ability.can("create", "User");
  const [createUser] = useMutation(CREATE_USER_FROM_CREATE_USER_ROUTE);
  const createForm = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, t("auth:form.name.required")),
        email: z.string().trim().email(t("auth:form.email.invalid")),
        password: z.string().min(8, t("auth:form.password.min")),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canCreate) return;
      try {
        const result = await createUser({
          variables: {
            input: {
              ...value,
              name: value.name.trim(),
              email: value.email.trim(),
            },
          },
        });
        if (!result.data?.createUser.id)
          throw new Error(t("admin:users.create.failed"));
        await navigate({
          to: "/admin/users",
          search: backSearch,
          replace: true,
        });
        toast.add({ type: "success", title: t("admin:users.create.success") });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("admin:users.create.failed");
        formApi.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.add({ type: "error", title: message });
      }
    },
  });
  const creating = useStore(createForm.store, (state) => state.isSubmitting);
  const createError = useStore(createForm.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <Page
      variant="compact"
      data-testid="admin-create-user-page"
      title={t("admin:users.create.title")}
      description={t("admin:users.create.description")}
      breadcrumbActions={[
        {
          label: t("admin:users.title"),
          render: <Link to={"/admin/users"} search={backSearch} />,
        },
      ]}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardHeader>
              <CardTitle>{t("admin:user.profile.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                id={formId}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (createForm.state.isSubmitting) return;
                  createForm.setErrorMap({ onSubmit: undefined });
                  createForm.handleSubmit();
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <createForm.Field name="name">
                      {(field) => (
                        <Input
                          label={t("admin:users.table.name")}
                          disabled={creating}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </createForm.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <createForm.Field name="email">
                      {(field) => (
                        <Input
                          type="email"
                          label={t("admin:users.table.email")}
                          disabled={creating}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </createForm.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <createForm.Field name="password">
                      {(field) => (
                        <Input
                          type="password"
                          label={t("admin:users.create.password")}
                          disabled={creating}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </createForm.Field>
                  </FormLayoutItem>
                  {createError && (
                    <FormLayoutItem>
                      <FieldError>{createError}</FieldError>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                form={formId}
                data-testid="admin-create-user-submit"
                disabled={!canCreate}
                loading={creating}
              >
                {t("admin:users.create.action")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
