import { Link, linkOptions } from "@tanstack/react-router";
import { t } from "i18next";
import { UsersRound } from "lucide-react";
import { SidebarUser } from "../../components/sidebar-user";
import type { ComponentProps, FC } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export const AdminSidebar: FC<ComponentProps<typeof Sidebar>> = (props) => {
  const usersLink = linkOptions({ to: "/admin/users" });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link to="/workspaces">
                  <img
                    src="/logo.svg"
                    alt={t("app.name")}
                    className="aspect-square size-8"
                  />
                  <span className="font-medium">{t("app.name")}</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar:admin.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link {...usersLink} data-testid="admin-sidebar-users-link">
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
      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
