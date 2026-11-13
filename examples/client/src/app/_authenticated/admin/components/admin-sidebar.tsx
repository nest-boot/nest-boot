import { linkOptions } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bot, KeyRound, LayoutDashboard, UsersRound } from "lucide-react";
import { AppSidebar } from "../../components/app-sidebar";
import type { ComponentProps, FC } from "react";
import { useAbility } from "@/contexts/ability-context";
import { Link } from "@/components/link";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export const AdminSidebar: FC<ComponentProps<typeof AppSidebar>> = (props) => {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const ability = useAbility();
  const usersLink = linkOptions({ to: "/admin/users" });

  return (
    <AppSidebar {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar:admin.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("common:overview.title")}
                  render={
                    <Link
                      to="/admin"
                      activeOptions={{ exact: true }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <LayoutDashboard />
                      <span>{t("common:overview.title")}</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              {ability.can("read", "User") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("sidebar:admin.users")}
                    render={
                      <Link {...usersLink} onClick={() => setOpenMobile(false)}>
                        <UsersRound />
                        <span>{t("sidebar:admin.users")}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )}
              {ability.can("read", "SystemApiKey") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("api-key:title")}
                    render={
                      <Link
                        to="/admin/api-keys"
                        onClick={() => setOpenMobile(false)}
                      >
                        <KeyRound />
                        <span>{t("api-key:title")}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )}
              {ability.can("read", "SystemAccount") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("admin:system_accounts.title")}
                    render={
                      <Link
                        to="/admin/system-accounts"
                        onClick={() => setOpenMobile(false)}
                      >
                        <Bot />
                        <span>{t("admin:system_accounts.title")}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </AppSidebar>
  );
};
