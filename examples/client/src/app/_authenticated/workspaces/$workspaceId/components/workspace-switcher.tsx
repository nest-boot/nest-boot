import { Check, ChevronsUpDown } from "lucide-react";

import { useQuery } from "@apollo/client/react";
import { t } from "i18next";
import { useMemo } from "react";
import { useCurrentWorkspaceContext } from "../contexts/current-workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { Link } from "@/components/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { graphql } from "@/gql";

const GET_WORKSPACES_FROM_WORKSPACE_SWITCHER = graphql(`
  query getWorkspacesFromWorkspaceSwitcher(
    $first: Int
    $after: String
    $before: String
    $query: String
    $orderBy: WorkspaceOrder
  ) {
    workspaces(
      first: $first
      after: $after
      before: $before
      query: $query
      orderBy: $orderBy
    ) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`);

export function WorkspaceSwitcher() {
  const { isMobile } = useSidebar();

  const currentWorkspace = useCurrentWorkspaceContext();

  const { data } = useQuery(GET_WORKSPACES_FROM_WORKSPACE_SWITCHER, {
    variables: { first: 10 },
  });

  const workspaces = useMemo(
    () => (data?.workspaces?.edges || []).map(({ node }) => node),
    [data],
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar>
                  <AvatarFallback>
                    {currentWorkspace.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {currentWorkspace.name}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t("sidebar:switcher.workspaces")}
              </DropdownMenuLabel>

              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  className="gap-2 p-2"
                  render={
                    <Link
                      key={workspace.id}
                      to="/workspaces/$workspaceId"
                      params={{ workspaceId: workspace.id }}
                      reloadDocument
                    >
                      {workspace.name}

                      {workspace.id === currentWorkspace.id && (
                        <Check className="ml-auto" />
                      )}
                    </Link>
                  }
                />
              ))}

              <DropdownMenuSeparator />

              <Link to="/workspaces/create">
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="text-muted-foreground font-medium">
                    {t("sidebar:switcher.createWorkspace")}
                  </div>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
