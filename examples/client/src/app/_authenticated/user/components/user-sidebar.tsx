import { Boxes, CircleUserRound, KeyRound, LockKeyhole } from "lucide-react";
import { t } from "i18next";

import { linkOptions } from "@tanstack/react-router";
import { SidebarUser } from "../../components/sidebar-user";
import type { ComponentProps, ComponentType, FC } from "react";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@/components/link";
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

type SidebarItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  link: LinkProps;
  testId: string;
};

export const UserSidebar: FC<ComponentProps<typeof Sidebar>> = (props) => {
  const items: Array<SidebarItem> = [
    {
      title: t("sidebar:user.account"),
      icon: CircleUserRound,
      link: linkOptions({ to: "/user" }),
      testId: "user-sidebar-account-link",
    },
    {
      title: t("sidebar:user.api_keys"),
      icon: KeyRound,
      link: linkOptions({ to: "/user/api-keys" }),
      testId: "user-sidebar-api-keys-link",
    },
    {
      title: t("sidebar:user.security"),
      icon: LockKeyhole,
      link: linkOptions({ to: "/user/security" }),
      testId: "user-sidebar-security-link",
    },
    {
      title: t("sidebar:user.workspaces"),
      icon: Boxes,
      link: linkOptions({ to: "/user/workspaces" }),
      testId: "user-sidebar-workspaces-link",
    },
  ];

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
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="text-primary font-medium">
                      {t("app.name")}
                    </span>
                  </div>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar:user.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={
                      <Link {...item.link} data-testid={item.testId}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
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
