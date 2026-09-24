import { t } from "i18next";
import { useMutation } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCurrentWorkspaceContext } from "../contexts/current-workspace-context";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import {
  workspaceSearchSchema,
  workspacesResourceKey,
} from "@/lib/workspace-search";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";

import { useAbility } from "@/contexts/ability-context";

import { alertDialog } from "@/components/thread-ui/alert-dialog";
import {
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import { Button } from "@/components/thread-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/thread-ui/input";
import { graphql } from "@/gql";
import { createAbilitySubject } from "@/lib/ability";

const UPDATE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation updateWorkspaceFromSettingsRoute(
    $id: ID!
    $input: UpdateWorkspaceInput!
  ) {
    updateWorkspace(id: $id, input: $input) {
      id
    }
  }
`);

const DELETE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation deleteWorkspaceFromSettingsRoute($id: ID!) {
    deleteWorkspace(id: $id) {
      id
    }
  }
`);

const LEAVE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation leaveWorkspaceFromSettingsRoute {
    leaveWorkspace {
      memberId
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/settings/",
)({
  component: ScopedSettingsComponent,
  beforeLoad: () => {
    return {
      title: t("workspace:title"),
    };
  },
});

function ScopedSettingsComponent() {
  const { workspaceId } = Route.useParams();
  return <SettingsComponent key={workspaceId} />;
}

function SettingsComponent() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();

  const workspace = useCurrentWorkspaceContext();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...workspacesResourceKey],
    searchSchema: workspaceSearchSchema,
  });
  const ability = useAbility();
  const workspaceSubject = createAbilitySubject("Workspace", workspace);
  const canUpdateWorkspace = ability.can("update", workspaceSubject);
  const canDeleteWorkspace = ability.can("delete", workspaceSubject);

  const [updateWorkspace] = useMutation(UPDATE_WORKSPACE_FROM_SETTINGS_ROUTE);
  const [deleteWorkspace, { loading: deleting, client }] = useMutation(
    DELETE_WORKSPACE_FROM_SETTINGS_ROUTE,
  );
  const [leaveWorkspace, { loading: leaving }] = useMutation(
    LEAVE_WORKSPACE_FROM_SETTINGS_ROUTE,
  );
  const form = useForm({
    defaultValues: {
      name: workspace.name,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateWorkspace({
          variables: {
            id: workspace.id,
            input: {
              name: value.name.trim(),
            },
          },
        });
        await router.invalidate();
        form.reset({ name: value.name.trim() });
        toast.add({ type: "success", title: t("workspace:settings.saved") });
      } catch (error) {
        toast.add({
          type: "error",
          title:
            error instanceof Error
              ? error.message
              : t("workspace:settings.save_failed"),
        });
      }
    },
  });

  const handleDelete = async () => {
    try {
      await deleteWorkspace({ variables: { id: workspace.id } });

      client.cache.evict({
        id: client.cache.identify({
          __typename: "Workspace",
          id: workspace.id,
        }),
      });

      navigate({
        to: "/user/workspaces",
        search: backSearch,
        reloadDocument: true,
      });
      toast.add({ type: "success", title: "工作区已成功删除" });
    } catch (error) {
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : "删除失败，请稍后重试",
      });
    }
  };

  const handleLeaveWorkspace = async () => {
    const confirmed = await alertDialog({
      title: t("workspace:settings.leave.confirm_title"),
      description: t("workspace:settings.leave.confirm_description"),
      confirmText: t("workspace:settings.leave.action"),
      cancelText: t("action.cancel"),
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await leaveWorkspace();
      await navigate({ to: "/user/workspaces", search: backSearch });
      toast.add({
        type: "success",
        title: t("workspace:settings.leave.success"),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : t("workspace:settings.leave.failed"),
      });
    }
  };

  return (
    <Page variant="compact">
      <PageHeader>
        <PageTitle>{t("workspace:title")}</PageTitle>
        <PageDescription>{t("workspace:settings.description")}</PageDescription>
      </PageHeader>
      <PageContent>
        <PageLayout>
          <PageLayoutSection>
            <Card>
              <CardContent>
                <form
                  id="workspace-settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                >
                  <FieldSet>
                    <FieldGroup>
                      <form.Field
                        name="name"
                        validators={{
                          onChange: ({ value }) =>
                            !value.trim()
                              ? t("workspace:settings.form.name.required")
                              : undefined,
                        }}
                      >
                        {(field) => (
                          <Input
                            id="name"
                            data-testid="workspace-settings-name-input"
                            label={t("workspace:settings.form.name.label")}
                            placeholder={t(
                              "workspace:settings.form.name.placeholder",
                            )}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={
                              field.state.meta.errors.length > 0
                                ? field.state.meta.errors
                                    .map((error: any) =>
                                      typeof error === "string"
                                        ? error
                                        : error?.message || error,
                                    )
                                    .join(", ")
                                : undefined
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
                      form="workspace-settings-form"
                      data-testid="workspace-settings-save"
                      disabled={!canUpdateWorkspace || !isDirty || !canSubmit}
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
                <CardTitle>{t("workspace:settings.leave.title")}</CardTitle>
                <CardDescription>
                  {t("workspace:settings.leave.description")}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  data-testid="workspace-leave"
                  variant="destructive"
                  loading={leaving}
                  onClick={handleLeaveWorkspace}
                >
                  {t("workspace:settings.leave.action")}
                </Button>
              </CardFooter>
            </Card>
          </PageLayoutSection>

          {canDeleteWorkspace ? (
            <PageLayoutSection>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("workspace:settings.dangerZone.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("workspace:settings.dangerZone.description")}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    data-testid="workspace-settings-delete"
                    disabled={!canDeleteWorkspace}
                    variant="destructive"
                    loading={deleting}
                    onClick={async () => {
                      const confirmed = await alertDialog({
                        title: t("workspace:settings.dangerZone.title"),
                        description: t(
                          "workspace:settings.dangerZone.description",
                        ),
                        variant: "destructive",
                        confirmText: t("action.delete"),
                        cancelText: t("action.cancel"),
                      });
                      if (confirmed) {
                        handleDelete();
                      }
                    }}
                  >
                    {t("workspace:settings.dangerZone.deleteButton")}
                  </Button>
                </CardFooter>
              </Card>
            </PageLayoutSection>
          ) : null}
        </PageLayout>
      </PageContent>
    </Page>
  );
}
