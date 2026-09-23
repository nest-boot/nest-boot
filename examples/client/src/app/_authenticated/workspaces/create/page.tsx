import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { AppTopbar } from "../../components/app-topbar";
import { Button } from "@/components/thread-ui/button";
import { Link } from "@/components/link";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import {
  BreadcrumbAction,
  BreadcrumbActions,
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

import { Input } from "@/components/thread-ui/input";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/workspaces/create/")({
  component: CreateWorkspaceComponent,
});

function CreateWorkspaceComponent() {
  const router = useRouter();
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
          to: `/workspaces/$workspaceId/settings`,
          params: { workspaceId: data.createWorkspace.id },
          reloadDocument: true,
        });
      }
    },
  });

  return (
    <Layout>
      <AppTopbar showSidebar={false} />
      <LayoutContent>
        <Page variant="compact">
          <PageHeader>
            <BreadcrumbActions>
              <BreadcrumbAction render={<Link to="/user/workspaces" />}>
                Workspaces
              </BreadcrumbAction>
            </BreadcrumbActions>
            <PageTitle>Create Workspace</PageTitle>
            <PageDescription>
              Create a new workspace to start managing your projects.
            </PageDescription>
          </PageHeader>
          <PageContent>
            <PageLayout>
              <PageLayoutSection>
                <Card>
                  <CardContent>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        form.handleSubmit();
                      }}
                    >
                      <FieldGroup>
                        <FieldSet>
                          <FieldGroup>
                            <form.Field name="name">
                              {(field) => (
                                <Input
                                  id="name"
                                  data-testid="workspace-create-name-input"
                                  label="Name"
                                  placeholder="My Workspace"
                                  required
                                  value={field.state.value}
                                  onChange={(e) =>
                                    field.handleChange(e.target.value)
                                  }
                                  onBlur={field.handleBlur}
                                />
                              )}
                            </form.Field>
                          </FieldGroup>
                        </FieldSet>

                        <Field orientation="horizontal">
                          <Button
                            type="submit"
                            data-testid="workspace-create-submit"
                            loading={loading}
                          >
                            Create
                          </Button>
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => router.history.back()}
                          >
                            Back
                          </Button>
                        </Field>
                      </FieldGroup>
                    </form>
                  </CardContent>
                </Card>
              </PageLayoutSection>
            </PageLayout>
          </PageContent>
        </Page>
      </LayoutContent>
    </Layout>
  );
}
