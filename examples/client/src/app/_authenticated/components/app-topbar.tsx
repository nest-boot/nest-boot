import { t } from "i18next";
import md5 from "md5";

import { useCurrentUserContext } from "../contexts/current-user-context";
import { UserMenu } from "./user-menu";
import { WorkspaceMenu } from "./workspace-menu";
import type { Workspace } from "@/components/thread-ui/topbar";
import { Link } from "@/components/link";
import { AvatarImage } from "@/components/ui/avatar";
import {
  Topbar,
  TopbarBrand,
  TopbarMenu,
  TopbarMenuContent,
  TopbarMenuSeparator,
  TopbarMenuTrigger,
  TopbarSidebarTrigger,
} from "@/components/thread-ui/topbar";

export function AppTopbar({
  currentWorkspace,
  showSidebar = true,
}: {
  currentWorkspace?: Workspace;
  showSidebar?: boolean;
}) {
  const currentUser = useCurrentUserContext();

  return (
    <Topbar>
      {showSidebar && <TopbarSidebarTrigger />}
      <TopbarBrand className={showSidebar ? undefined : "block"}>
        <Link to="/workspaces" className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="size-8" />
          <span>{t("app.name")}</span>
        </Link>
      </TopbarBrand>
      <TopbarMenu
        currentWorkspace={currentWorkspace}
        user={{
          name: currentUser.name,
          email: currentUser.email,
          avatar: (
            <AvatarImage
              src={`https://www.gravatar.com/avatar/${md5(currentUser.email)}?s=32&d=identicon`}
              alt={currentUser.name}
            />
          ),
        }}
      >
        <TopbarMenuTrigger data-testid="topbar-menu-trigger" />
        <TopbarMenuContent>
          <WorkspaceMenu currentWorkspaceId={currentWorkspace?.id} />
          <TopbarMenuSeparator />
          <UserMenu />
        </TopbarMenuContent>
      </TopbarMenu>
    </Topbar>
  );
}
