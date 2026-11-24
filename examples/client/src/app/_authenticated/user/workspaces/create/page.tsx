import { createFileRoute } from "@tanstack/react-router";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { defaultFormOptions, handleFieldBlur, submitForm } from "@/lib/form";
import { getFormErrorMessage } from "@/lib/form-errors";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";
import { workspaceSearchSchema } from "@/schemas/workspace-search-schema";
import { workspacesResourceKey } from "@/lib/resource-keys";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

import { Link } from "@/components/link";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { graphql } from "@/gql";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";

const CREATE_WORKSPACE_FROM_CREATE_WORKSPACE_ROUTE = graphql(`
  mutation createWorkspaceFromCreateWorkspaceRoute(
    $input: CreateWorkspaceInput!
  ) {
    createWorkspace(input: $input) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/user/workspaces/create/")(
  {
    component: CreateWorkspaceComponent,
  },
);

function CreateWorkspaceComponent() {
  const { t } = useTranslation();
  const currentUser = useAuthUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...workspacesResourceKey],
    searchSchema: workspaceSearchSchema,
  });
  const navigate = Route.useNavigate();

  const [createWorkspace] = useMutation(
    CREATE_WORKSPACE_FROM_CREATE_WORKSPACE_ROUTE,
  );

  const form = useForm({
    ...defaultFormOptions,
    defaultValues: {
      name: "",
    },
    validators: {
      onDynamic: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("workspace:settings.form.name.required"))
          .max(255, t("common:validation.max_length", { max: 255 })),
      }),
    },

    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await createWorkspace({
          variables: {
            input: {
              name: value.name.trim(),
            },
          },
        });
        if (!data?.createWorkspace.id)
          throw new Error(t("workspace:create.failed"));
        await navigate({
          to: `/workspaces/$workspaceId`,
          params: { workspaceId: data.createWorkspace.id },
          reloadDocument: true,
        });
      } catch {
        formApi.setErrorMap({
          onSubmit: { form: t("workspace:create.failed"), fields: {} },
        });
      }
    },
  });
  const error = useSelector(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <Page
      variant="compact"
      title={t("workspace:create.title")}
      description={t("workspace:create.description")}
      breadcrumbActions={[
        {
          label: t("user:workspaces.title"),
          render: <Link to="/user/workspaces" search={backSearch} />,
        },
      ]}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <form
                id="workspace-create-form"
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
                          label={t("workspace:create.form.name.label")}
                          placeholder={t(
                            "workspace:create.form.name.placeholder",
                          )}
                          required
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                  {error && (
                    <FormLayoutItem>
                      <p role="alert">{error}</p>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <SubmitButton formApi={form} form="workspace-create-form">
                {t("common:action.create")}
              </SubmitButton>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
