import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";

import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { graphql } from "@/gql";

const CREATE_WORKSPACE_FROM_CREATE_WORKSPACE_FORM = graphql(`
  mutation createWorkspaceFromCreateWorkspaceForm(
    $input: CreateWorkspaceInput!
  ) {
    createWorkspace(input: $input) {
      id
    }
  }
`);

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "工作空间名称至少需要 2 个字符",
  }),
});

export function CreateWorkspaceForm() {
  const navigate = useNavigate();

  const [createWorkspaceMutation, { loading }] = useMutation(
    CREATE_WORKSPACE_FROM_CREATE_WORKSPACE_FORM,
  );

  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onSubmit: FormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await createWorkspaceMutation({
          variables: {
            input: {
              name: value.name,
            },
          },
        });

        if (result.data?.createWorkspace) {
          toast.success("工作空间创建成功！");
          // 跳转到新创建的工作空间
          navigate({
            to: "/workspaces/$workspaceId",
            params: { workspaceId: result.data.createWorkspace.id },
            reloadDocument: true,
          });
        }
      } catch (error) {
        console.error("创建工作空间失败:", error);
        toast.error("创建工作空间失败，请稍后重试");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      data-testid="workspace-create-form"
      className="space-y-6"
    >
      <form.Field name="name">
        {(field) => (
          <Input
            id="name"
            data-testid="workspace-create-name-input"
            label="工作空间名称"
            description="为您的工作空间起一个容易识别的名称"
            placeholder="例如：我的团队"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            error={
              field.form.state.isSubmitted && field.state.meta.errors.length > 0
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

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            data-testid="workspace-create-submit"
            loading={isSubmitting || loading}
            className="w-full"
          >
            创建工作空间
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
