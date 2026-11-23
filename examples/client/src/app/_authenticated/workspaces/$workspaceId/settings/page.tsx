import { t } from "i18next";
import { useMutation } from "@apollo/client/react";
import { z } from "zod";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { useSelectedWorkspaceContext } from "../contexts/selected-workspace-context";
import {
  defaultFormOptions,
  handleFieldBlur,
  resetFormAfterSave,
  submitForm,
} from "@/lib/form";

import { useFormChanges } from "@/hooks/use-form-changes";
import { refreshAfterMutation } from "@/lib/refresh-after-mutation";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { workspaceSearchSchema } from "@/schemas/workspace-search-schema";
import { workspacesResourceKey } from "@/lib/resource-keys";
import {
  createUrlIdentifierSchema,
  urlIdentifierInput,
} from "@/lib/url-identifier";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";

import { useAbility } from "@/contexts/ability-context";

import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Page } from "@/components/thread-ui/page";
import { Button } from "@/components/thread-ui/button";
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
import { createAbilitySubject } from "@/lib/ability";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";
import { getFormErrorMessage } from "@/lib/form-errors";

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

  const workspace = useSelectedWorkspaceContext();
  const currentUser = useAuthUserContext();
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
  const workspaceChanges = useFormChanges({
    name: workspace.name.trim(),
    slug: workspace.slug,
  });
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: workspaceChanges.defaultValues,
    validators: {
      onDynamic: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("workspace:settings.form.name.required"))
          .max(255, t("common:validation.max_length", { max: 255 })),
        slug: createUrlIdentifierSchema(
          t("workspace:settings.form.slug.format"),
        ),
      }),
    },
    onSubmit: async ({ value }) => {
      const values = { name: value.name.trim(), slug: value.slug.trim() };
      const input = workspaceChanges.getChanges(values);
      if (!Object.keys(input).length) return;
      try {
        await updateWorkspace({
          variables: {
            id: workspace.id,
            input,
          },
        });
        await refreshAfterMutation(() => router.invalidate());
        workspaceChanges.accept(values);
        resetFormAfterSave(form, value, values);
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
    <Page
      variant="compact"
      title={t("workspace:title")}
      description={t("workspace:settings.description")}
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              <form
                id="workspace-settings-form"
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
                          label={t("workspace:settings.form.name.label")}
                          placeholder={t(
                            "workspace:settings.form.name.placeholder",
                          )}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <form.Field name="slug">
                      {(field) => (
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={() => handleFieldBlur(field)}
                          error={getFormErrorMessage(field.state.meta.errors)}
                          id="slug"
                          label={t("workspace:settings.form.slug.label")}
                          title={t("workspace:settings.form.slug.format")}
                          required
                          {...urlIdentifierInput}
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
                form="workspace-settings-form"
                requireDirty
                disabled={!canUpdateWorkspace}
              >
                {t("action.save")}
              </SubmitButton>
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
    </Page>
  );
}
