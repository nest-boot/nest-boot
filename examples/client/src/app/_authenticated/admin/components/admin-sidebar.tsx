import { Link, linkOptions } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UsersRound } from "lucide-react";
import type { ComponentProps, FC } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export const AdminSidebar: FC<ComponentProps<typeof Sidebar>> = (props) => {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const usersLink = linkOptions({ to: "/admin/users" });

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar:admin.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      {...usersLink}
                      data-testid="admin-sidebar-users-link"
                      onClick={() => setOpenMobile(false)}
                    >
                      <UsersRound />
                      <span>{t("sidebar:admin.users")}</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
