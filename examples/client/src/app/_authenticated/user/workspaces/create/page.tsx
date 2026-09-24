import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { workspaceSearchSchema } from "@/schemas/workspace-search-schema";
import { workspacesResourceKey } from "@/lib/resource-keys";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { Button } from "@/components/thread-ui/button";
import { Link } from "@/components/link";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { graphql } from "@/gql";

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
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...workspacesResourceKey],
    searchSchema: workspaceSearchSchema,
  });
  const navigate = Route.useNavigate();

  const [createWorkspace, { loading }] = useMutation(
    CREATE_WORKSPACE_FROM_CREATE_WORKSPACE_ROUTE,
  );

  const form = useForm({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      const { data } = await createWorkspace({
        variables: {
          input: {
            name: value.name,
          },
        },
      });

      if (data?.createWorkspace.id) {
        navigate({
          to: `/workspaces/$workspaceId`,
          params: { workspaceId: data.createWorkspace.id },
          reloadDocument: true,
        });
      }
    },
  });

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
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  form.handleSubmit();
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          id="name"
                          label={t("workspace:create.form.name.label")}
                          placeholder={t(
                            "workspace:create.form.name.placeholder",
                          )}
                          required
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                </FormLayout>
              </form>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                form="workspace-create-form"
                loading={loading}
              >
                {t("common:action.create")}
              </Button>
            </CardFooter>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
