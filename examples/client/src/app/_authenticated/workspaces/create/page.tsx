import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { AppTopbar } from "../../components/app-topbar";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { workspaceSearchSchema } from "@/schemas/workspace-search-schema";
import { workspacesResourceKey } from "@/lib/resource-keys";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { Button } from "@/components/thread-ui/button";
import { Link } from "@/components/link";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

import { Input } from "@/components/thread-ui/input";
import { FieldGroup, FieldSet } from "@/components/ui/field";
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

export const Route = createFileRoute("/_authenticated/workspaces/create/")({
  component: CreateWorkspaceComponent,
});

function CreateWorkspaceComponent() {
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
    <Layout>
      <AppTopbar showSidebar={false} />
      <LayoutContent data-scroll-restoration-id="main-content">
        <Page
          variant="compact"
          title="Create Workspace"
          description="Create a new workspace to start managing your projects."
          breadcrumbActions={[
            {
              label: "Workspaces",
              render: <Link to={"/user/workspaces"} search={backSearch} />,
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
                    </FieldGroup>
                  </form>
                </CardContent>
                <CardFooter>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      form="workspace-create-form"
                      data-testid="workspace-create-submit"
                      loading={loading}
                    >
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      render={
                        <Link to="/user/workspaces" search={backSearch} />
                      }
                    >
                      Back
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </PageLayoutSection>
          </PageLayout>
        </Page>
      </LayoutContent>
    </Layout>
  );
}
