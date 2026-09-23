import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppTopbar } from "../../components/app-topbar";
import { CurrentWorkspaceProvider } from "./contexts/current-workspace-context";
import { CurrentMemberProvider } from "./contexts/current-member-context";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import { graphql } from "@/gql";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import { createAbility, createAbilitySubject } from "@/lib/ability";
import { AbilityProvider } from "@/contexts/ability-context";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_CURRENT_WORKSPACE_FROM_WORKSPACE_LAYOUT = graphql(`
  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {
    workspace(id: $workspaceId) {
      id
      name
      createdAt
      updatedAt
    }
    currentMember {
      workspaceId
      id
      roles
      permissions
      status
      name
      email
    }
    currentAbilityRules {
      actions
      subjects
      fields
      conditions
      inverted
      reason
    }
  }
`);

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId")(
  {
    component: WorkspaceLayout,
    beforeLoad: async ({ context: { apolloClient }, params }) => {
      const { data, error } = await apolloClient.query({
        query: GET_CURRENT_WORKSPACE_FROM_WORKSPACE_LAYOUT,
        variables: {
          workspaceId: params.workspaceId,
        },
        context: { headers: { "x-workspace-id": params.workspaceId } },
        errorPolicy: "all",
        fetchPolicy: "network-only",
      });

      if (error && !isAccessDenied(error)) throw error;
      if (error || !data?.workspace || !data.currentMember) {
        throw redirect({ to: "/workspaces" });
      }

      const ability = createAbility(data.currentAbilityRules);
      if (
        !ability.can("read", createAbilitySubject("Workspace", data.workspace))
      ) {
        throw redirect({ to: "/workspaces" });
      }

      return {
        currentMember: data.currentMember,
        currentWorkspace: data.workspace,
        ability,
      };
    },
  },
);

function WorkspaceLayout() {
  const { currentWorkspace, currentMember, ability } = Route.useRouteContext();
  return (
    <CurrentWorkspaceProvider value={currentWorkspace}>
      <CurrentMemberProvider value={currentMember}>
        <AbilityProvider ability={ability}>
          <Layout>
            <AppTopbar currentWorkspace={currentWorkspace} />
            <WorkspaceSidebar />

            <LayoutContent>
              <Outlet />
            </LayoutContent>
          </Layout>
        </AbilityProvider>
      </CurrentMemberProvider>
    </CurrentWorkspaceProvider>
  );
}
