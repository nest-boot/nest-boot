import { useState } from "react";
import md5 from "md5";
import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrentUserContext } from "../contexts/current-user-context";
import { UserMenu } from "./user-menu";
import { WorkspaceMenu } from "./workspace-menu";
import type { Workspace } from "@/components/thread-ui/sidebar-account-menu";
import {
  SidebarAccountMenu,
  SidebarAccountMenuItem,
} from "@/components/thread-ui/sidebar-account-menu";
import { Link } from "@/components/link";
import { AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/components/ui/sidebar";

export function AppAccountMenu({ workspace }: { workspace?: Workspace }) {
  const { t } = useTranslation();
  const currentUser = useCurrentUserContext();
  const { setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([]);

  return (
    <SidebarAccountMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setWorkspaces([]);
      }}
      workspace={workspace}
      recentWorkspaces={workspace ? workspaces : undefined}
      maxRecentWorkspaces={workspaces.length + (workspace ? 1 : 0)}
      user={{
        "aria-label": t("sidebar:user.openOverview", {
          name: currentUser.name,
        }),
        name: currentUser.name,
        email: currentUser.email,
        avatar: (
          <AvatarImage
            src={`https://www.gravatar.com/avatar/${md5(currentUser.email)}?s=32&d=identicon`}
            alt={currentUser.name}
          />
        ),
        render: <Link to="/user" onClick={() => setOpenMobile(false)} />,
      }}
    >
      {open && workspace && (
        <WorkspaceMenu onWorkspacesChange={setWorkspaces} />
      )}
      <SidebarAccountMenuItem
        render={
          <Link to="/user/workspaces" onClick={() => setOpenMobile(false)} />
        }
      >
        <Boxes />
        {t("sidebar:switcher.manageWorkspaces")}
      </SidebarAccountMenuItem>
      <UserMenu />
    </SidebarAccountMenu>
  );
}
