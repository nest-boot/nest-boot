import { z } from "zod";
import { t } from "i18next";
import { toast } from "sonner";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/thread-ui/button";

import { Input } from "@/components/thread-ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
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
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("workspace:settings.form.name.required"))
          .max(255, t("workspace:settings.form.name.too_long")),
      }),
    },
    onSubmit: async ({ value }) => {
      let id: string | undefined;
      try {
        const { data } = await createWorkspace({
          variables: {
            input: {
              name: value.name.trim(),
            },
          },
        });

        id = data?.createWorkspace.id;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("workspace:create.failed"),
        );
        return;
      }
      if (id) {
        navigate({
          to: `/workspaces/$workspaceId/settings`,
          params: { workspaceId: id },
          reloadDocument: true,
        });
      }
    },
  });

  return (
    <div className="mx-auto flex h-screen w-full items-center justify-center">
      <div className="w-full max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <FieldSet>
              <FieldLegend>{t("workspace:create.title")}</FieldLegend>
              <FieldDescription>
                {t("workspace:create.description")}
              </FieldDescription>
              <FieldGroup>
                <form.Field name="name">
                  {(field) => (
                    <Input
                      id="name"
                      data-testid="workspace-create-name-input"
                      label={t("workspace:settings.form.name.label")}
                      placeholder={t(
                        "workspace:settings.form.name.placeholder",
                      )}
                      required
                      error={field.state.meta.errors
                        .map((error) => error?.message)
                        .filter(Boolean)
                        .join(", ")}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
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
      </div>
    </div>
  );
}
