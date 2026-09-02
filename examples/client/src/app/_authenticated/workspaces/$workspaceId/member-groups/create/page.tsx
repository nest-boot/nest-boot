import { useMutation } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { t } from "i18next";
import * as z from "zod";

import type {
  CreateWorkspaceMemberGroupInput,
  WorkspacePermission,
} from "@/gql/graphql";
import {
  Page,
  PageContent,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { Textarea } from "@/components/thread-ui/textarea";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { graphql } from "@/gql";

const CREATE_WORKSPACE_MEMBER_GROUP_FROM_CREATE_WORKSPACE_MEMBER_GROUP_ROUTE =
  graphql(`
    mutation createWorkspaceMemberGroupFromCreateWorkspaceMemberGroupRoute(
      $input: CreateWorkspaceMemberGroupInput!
    ) {
      createWorkspaceMemberGroup(input: $input) {
        id
        name
      }
    }
  `);

const formSchema = z.object({
  name: z
    .string()
    .min(1, t("workspace-member-group:detail.form.name_field.rules.min"))
    .max(255, t("workspace-member-group:detail.form.name_field.rules.max")),
  description: z.string(),
  permissions: z.array(z.any()),
});

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/member-groups/create/",
)({
  component: CreateWorkspaceMemberGroupComponent,
  beforeLoad: () => {
    return {
      title: t("workspace-member-group:create.title"),
    };
  },
});

function CreateWorkspaceMemberGroupComponent() {
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();

  const [createWorkspaceMemberGroup, { loading: createLoading }] = useMutation(
    CREATE_WORKSPACE_MEMBER_GROUP_FROM_CREATE_WORKSPACE_MEMBER_GROUP_ROUTE,
  );

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      permissions: [] as Array<WorkspacePermission>,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const input: CreateWorkspaceMemberGroupInput = {
          name: value.name,
          description: value.description || undefined,
          permissions: value.permissions,
        };

        const result = await createWorkspaceMemberGroup({
          variables: {
            input,
          },
        });

        if (result.data?.createWorkspaceMemberGroup) {
          toast.success(t("workspace-member-group:create.success_toast"));
          navigate({
            to: "/workspaces/$workspaceId/member-groups/$memberGroupId",
            params: {
              workspaceId,
              memberGroupId: result.data.createWorkspaceMemberGroup.id,
            },
          });
        }
      } catch (error) {
        toast.error(t("workspace-member-group:create.error_toast"), {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });

  return (
    <Page variant="compact">
      <PageHeader>
        <PageTitle>{t("workspace-member-group:create.title")}</PageTitle>
      </PageHeader>
      <PageContent>
        <form
          id="workspace-member-group-form"
          data-testid="member-group-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldSet>
            <FieldGroup>
              <form.Field name="name">
                {(field) => (
                  <Input
                    id={field.name}
                    name={field.name}
                    data-testid="member-group-create-name-input"
                    label={t(
                      "workspace-member-group:detail.form.name_field.label",
                    )}
                    description={t(
                      "workspace-member-group:detail.form.name_field.description",
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={
                      field.form.state.isSubmitted &&
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
                    aria-required="true"
                    required
                    autoComplete="off"
                    disabled={createLoading}
                  />
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    data-testid="member-group-create-description-input"
                    label={t(
                      "workspace-member-group:detail.form.description_field.label",
                    )}
                    description={t(
                      "workspace-member-group:detail.form.description_field.description",
                    )}
                    placeholder={t(
                      "workspace-member-group:detail.form.description_field.placeholder",
                    )}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={4}
                    disabled={createLoading}
                  />
                )}
              </form.Field>

              <form.Field name="permissions">
                {(field) => (
                  <PermissionCheckboxGroup
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={createLoading}
                  />
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => [state.isSubmitting, state.canSubmit]}
              >
                {([isSubmitting, canSubmit]) => (
                  <Field orientation="horizontal">
                    <Button
                      type="submit"
                      data-testid="member-group-create-submit"
                      disabled={!canSubmit}
                      loading={isSubmitting}
                    >
                      {t("action.create")}
                    </Button>
                  </Field>
                )}
              </form.Subscribe>
            </FieldGroup>
          </FieldSet>
        </form>
      </PageContent>
    </Page>
  );
}
