import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { Link } from "@/components/link";
import { WorkspaceServiceAccountForm } from "@/components/workspace-service-account-form";
import { Page } from "@/components/thread-ui/page";
import { WorkspaceMemberType } from "@/gql/graphql";
import { graphql } from "@/gql";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { createAbilitySubject } from "@/lib/ability";
import { getWorkspaceMembersResourceKey } from "@/lib/resource-keys";
import { workspaceMemberSearchSchema } from "@/schemas/workspace-member-search-schema";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_WORKSPACE_SERVICE_ACCOUNT_GRANTS = graphql(`
  query getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute {
    workspaceRoles {
      role
      grantable
    }
    workspacePermissions {
      permission
      grantable
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/create-service-account/",
)({
  component: CreateWorkspaceServiceAccountPage,
  beforeLoad: async ({ context, params }) => {
    if (!context.ability.can("read", "WorkspaceMember")) {
      throw redirect({ to: "/workspaces/$workspaceId", params });
    }
    if (
      !context.ability.can(
        "write",
        createAbilitySubject("WorkspaceMember", {
          workspaceId: params.workspaceId,
          type: WorkspaceMemberType.SERVICE_ACCOUNT,
        }),
      )
    ) {
      throw redirect({ to: "/workspaces/$workspaceId/members", params });
    }
    const { data } = await context.apolloClient
      .query({
        query: GET_WORKSPACE_SERVICE_ACCOUNT_GRANTS,
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error))
          throw redirect({ to: "/workspaces/$workspaceId/members", params });
        throw error;
      });
    return {
      title: t("workspace-member:service_account.create"),
      roleOptions: data?.workspaceRoles ?? [],
      permissionOptions: data?.workspacePermissions ?? [],
    };
  },
});

function CreateWorkspaceServiceAccountPage() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { roleOptions, permissionOptions } = Route.useRouteContext();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceMembersResourceKey(workspaceId)],
    searchSchema: workspaceMemberSearchSchema,
  });

  return (
    <Page
      variant="compact"
      title={t("workspace-member:service_account.create")}
      breadcrumbActions={[
        {
          label: t("workspace-member:title"),
          render: (
            <Link
              to="/workspaces/$workspaceId/members"
              params={{ workspaceId }}
              search={backSearch}
            />
          ),
        },
      ]}
    >
      <WorkspaceServiceAccountForm
        key={workspaceId}
        workspaceId={workspaceId}
        roleOptions={roleOptions}
        permissionOptions={permissionOptions}
      />
    </Page>
  );
}
