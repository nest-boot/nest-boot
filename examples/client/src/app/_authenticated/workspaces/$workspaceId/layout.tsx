import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { CurrentWorkspaceProvider } from "./contexts/current-workspace-context";
import { CurrentWorkspaceMemberProvider } from "./contexts/current-workspace-member-context";
import { CurrentUserProvider } from "./contexts/current-user-context";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import { graphql } from "@/gql";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";

const GET_CURRENT_WORKSPACE_FROM_WORKSPACE_LAYOUT = graphql(`
  query getCurrentWorkspaceFromWorkspaceLayout($workspaceId: ID!) {
    workspace(id: $workspaceId) {
      id
    }
    currentWorkspaceMember {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId")(
  {
    component: WorkspaceLayout,
    beforeLoad: async ({ context: { apolloClient }, params }) => {
      const { data } = await apolloClient.query({
        query: GET_CURRENT_WORKSPACE_FROM_WORKSPACE_LAYOUT,
        variables: {
          workspaceId: params.workspaceId,
        },
        errorPolicy: "ignore",
        fetchPolicy: "cache-first",
      });

      if (!data?.workspace || !data.currentWorkspaceMember) {
        throw redirect({ to: "/workspaces" });
      }
    },
  },
);

function WorkspaceLayout() {
  return (
    <CurrentUserProvider>
      <CurrentWorkspaceProvider>
        <CurrentWorkspaceMemberProvider>
          <SidebarProvider>
            <WorkspaceSidebar />

            <SidebarInset>
              <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] duration-200 ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:left-(--sidebar-width) md:group-has-data-[collapsible=icon]/sidebar-wrapper:left-(--sidebar-width-icon)">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger />

                  <Breadcrumbs />
                </div>
              </header>

              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </CurrentWorkspaceMemberProvider>
      </CurrentWorkspaceProvider>
    </CurrentUserProvider>
  );
}
