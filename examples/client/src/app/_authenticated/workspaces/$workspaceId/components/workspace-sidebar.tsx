import { KeyRound, Settings, User, Users } from "lucide-react";

import { linkOptions, useParams } from "@tanstack/react-router";
import { t } from "i18next";
import { SidebarLogo } from "./sidebar-logo";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { SidebarUser } from "./sidebar-user";
import type { LinkProps } from "@tanstack/react-router";
import type { ComponentProps, ComponentType, FC } from "react";
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

import { Link } from "@/components/link";

type SidebarItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  link: LinkProps;
  testId?: string;
};

export const WorkspaceSidebar: FC<ComponentProps<typeof Sidebar>> = ({
  ...props
}) => {
  const workspaceId = useParams({
    from: "/_authenticated/workspaces/$workspaceId",
    select: (params) => params.workspaceId,
  });

  const sidebarGroups: Array<{
    title: string;
    items: Array<SidebarItem>;
  }> = [
    {
      title: t("sidebar:navigation.settings"),
      items: [
        {
          title: t("sidebar:navigation.api_keys"),
          icon: KeyRound,
          link: linkOptions({
            to: "/workspaces/$workspaceId/api-keys",
            params: { workspaceId },
          }),
          testId: "workspace-sidebar-api-keys-link",
        },
        {
          title: t("sidebar:navigation.members"),
          icon: User,
          link: linkOptions({
            to: "/workspaces/$workspaceId/members",
            params: { workspaceId },
          }),
        },
        {
          title: t("sidebar:navigation.member_groups"),
          icon: Users,
          link: linkOptions({
            to: "/workspaces/$workspaceId/member-groups",
            params: { workspaceId },
          }),
        },
        {
          title: t("sidebar:navigation.settings"),
          icon: Settings,
          link: linkOptions({
            to: "/workspaces/$workspaceId/settings",
            params: { workspaceId },
          }),
        },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />

        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {sidebarGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
