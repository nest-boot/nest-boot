import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { t } from "i18next";
import { toast } from "sonner";

import { useCurrentWorkspaceContext } from "../contexts/current-workspace-context";
import {
  useCurrentWorkspaceAbility,
  useCurrentWorkspaceMemberContext,
} from "../contexts/current-workspace-member-context";
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
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/thread-ui/input";
import { Select } from "@/components/thread-ui/select";
import { graphql } from "@/gql";
import { WorkspaceMemberStatus, WorkspaceMemberType } from "@/gql/graphql";
import { WORKSPACE_OWNER_ROLE, hasWorkspaceRole } from "@/lib/workspace-roles";
import { createAbilitySubject } from "@/lib/ability";

const UPDATE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation updateWorkspaceFromSettingsRoute($input: UpdateWorkspaceInput!) {
    updateWorkspace(input: $input) {
      id
      name
    }
  }
`);

const DELETE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation deleteWorkspaceFromSettingsRoute {
    deleteWorkspace {
      id
    }
  }
`);

const GET_TRANSFER_CANDIDATES_FROM_SETTINGS_ROUTE = graphql(`
  query getTransferCandidatesFromSettingsRoute {
    workspaceMembers(first: 100) {
      edges {
        node {
          id
          name
          email
          roles
          status
          type
        }
      }
    }
  }
`);

const TRANSFER_WORKSPACE_OWNERSHIP_FROM_SETTINGS_ROUTE = graphql(`
  mutation transferWorkspaceOwnershipFromSettingsRoute($memberId: ID!) {
    transferWorkspaceOwnership(memberId: $memberId) {
      id
      roles
    }
  }
`);

const LEAVE_WORKSPACE_FROM_SETTINGS_ROUTE = graphql(`
  mutation leaveWorkspaceFromSettingsRoute {
    leaveWorkspace {
      id
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/settings/",
)({
  component: SettingsComponent,
  beforeLoad: () => {
    return {
      title: "设置",
    };
  },
});

function SettingsComponent() {
  const navigate = useNavigate();

  const workspace = useCurrentWorkspaceContext();
  const currentWorkspaceMember = useCurrentWorkspaceMemberContext();
  const currentWorkspaceAbility = useCurrentWorkspaceAbility();
  const isOwner = hasWorkspaceRole(
    currentWorkspaceMember.roles,
    WORKSPACE_OWNER_ROLE,
  );
  const [nextOwnerId, setNextOwnerId] = useState<string | null>(null);
  const workspaceSubject = createAbilitySubject("Workspace", workspace);
  const canUpdateWorkspace = currentWorkspaceAbility.can(
    "update",
    workspaceSubject,
  );
  const canDeleteWorkspace = currentWorkspaceAbility.can(
    "delete",
    workspaceSubject,
  );

  const [updateWorkspace] = useMutation(UPDATE_WORKSPACE_FROM_SETTINGS_ROUTE);
  const [deleteWorkspace, { loading: deleting, client }] = useMutation(
    DELETE_WORKSPACE_FROM_SETTINGS_ROUTE,
  );
  const { data: memberData } = useQuery(
    GET_TRANSFER_CANDIDATES_FROM_SETTINGS_ROUTE,
    { skip: !isOwner },
  );
  const [transferWorkspaceOwnership, { loading: transferring }] = useMutation(
    TRANSFER_WORKSPACE_OWNERSHIP_FROM_SETTINGS_ROUTE,
  );
  const [leaveWorkspace, { loading: leaving }] = useMutation(
    LEAVE_WORKSPACE_FROM_SETTINGS_ROUTE,
  );
  const transferCandidates =
    memberData?.workspaceMembers.edges
      .map(({ node }) => node)
      .filter(
        (member) =>
          member.id !== currentWorkspaceMember.id &&
          member.status === WorkspaceMemberStatus.ACTIVE &&
          member.type === WorkspaceMemberType.USER,
      ) ?? [];

  const form = useForm({
    defaultValues: {
      name: workspace.name,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateWorkspace({
          variables: {
            input: {
              name: value.name.trim(),
            },
          },
        });
        form.reset({ name: value.name.trim() });
        toast.success("保存成功");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "保存失败，请稍后重试",
        );
      }
    },
  });

  const handleDelete = async () => {
    try {
      await deleteWorkspace();

      client.cache.evict({
        id: client.cache.identify({
          __typename: "Workspace",
          id: workspace.id,
        }),
      });

      navigate({
        to: "/workspaces",
        reloadDocument: true,
      });
      toast.success("工作区已成功删除");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "删除失败，请稍后重试",
      );
    }
  };

  const handleTransferOwnership = async () => {
    if (!nextOwnerId) return;
    const nextOwner = transferCandidates.find(
      (member) => member.id === nextOwnerId,
    );
    const confirmed = await alertDialog({
      title: t("workspace:settings.ownership.confirm_title"),
      description: t("workspace:settings.ownership.confirm_description", {
        name: nextOwner?.name ?? nextOwner?.email ?? nextOwnerId,
      }),
      confirmText: t("workspace:settings.ownership.action"),
      cancelText: t("action.cancel"),
    });
    if (!confirmed) return;

    try {
      await transferWorkspaceOwnership({
        variables: { memberId: nextOwnerId },
      });
      setNextOwnerId(null);
      await client.refetchQueries({ include: "active" });
      toast.success(t("workspace:settings.ownership.success"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:settings.ownership.failed"),
      );
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
      await navigate({ to: "/user/workspaces" });
      toast.success(t("workspace:settings.leave.success"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:settings.leave.failed"),
      );
    }
  };

  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("workspace:title")}</PageTitle>
        <PageDescription>{t("workspace:settings.description")}</PageDescription>
      </PageHeader>
      <PageContent>
        <form
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
                    placeholder={t("workspace:settings.form.name.placeholder")}
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

              <form.Subscribe
                selector={(state) => [
                  state.isDirty,
                  state.isSubmitting,
                  state.canSubmit,
                ]}
              >
                {([isDirty, isSubmitting, canSubmit]) => (
                  <Field orientation="horizontal">
                    <Button
                      type="submit"
                      data-testid="workspace-settings-save"
                      disabled={!canUpdateWorkspace || !isDirty || !canSubmit}
                      loading={isSubmitting}
                    >
                      {t("action.save")}
                    </Button>
                  </Field>
                )}
              </form.Subscribe>
            </FieldGroup>
          </FieldSet>
        </form>

        {isOwner ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t("workspace:settings.ownership.title")}</CardTitle>
              <CardDescription>
                {t("workspace:settings.ownership.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                label={t("workspace:settings.ownership.member")}
                placeholder={t("workspace:settings.ownership.placeholder")}
                items={transferCandidates.map((member) => ({
                  label: member.name || member.email || member.id,
                  value: member.id,
                }))}
                value={nextOwnerId}
                onValueChange={setNextOwnerId}
              />
            </CardContent>
            <CardFooter>
              <Button
                data-testid="workspace-transfer-ownership"
                disabled={!nextOwnerId}
                loading={transferring}
                onClick={handleTransferOwnership}
              >
                {t("workspace:settings.ownership.action")}
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {!isOwner ? (
          <Card className="border-destructive mt-8">
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
        ) : null}

        {isOwner ? (
          <Card className="border-destructive mt-8">
            <CardHeader>
              <CardTitle className="text-destructive">
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
                    description: t("workspace:settings.dangerZone.description"),
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
        ) : null}
      </PageContent>
    </Page>
  );
}
