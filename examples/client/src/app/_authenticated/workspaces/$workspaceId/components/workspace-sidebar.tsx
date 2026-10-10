import { KeyRound, LayoutDashboard, Settings, User } from "lucide-react";

import { linkOptions, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "../../../components/app-sidebar";

import type { LinkProps } from "@tanstack/react-router";
import type { ComponentProps, ComponentType, FC } from "react";
import { useAbility } from "@/contexts/ability-context";
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

import { Link } from "@/components/link";

type SidebarItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  link: LinkProps;
};

export const WorkspaceSidebar: FC<ComponentProps<typeof AppSidebar>> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const workspaceId = useParams({
    from: "/_authenticated/workspaces/$workspaceId",
    select: (params) => params.workspaceId,
  });
  const { setOpenMobile } = useSidebar();
  const ability = useAbility();

  const sidebarGroups: Array<{
    title: string;
    items: Array<SidebarItem>;
  }> = [
    {
      title: t("common:overview.workspace"),
      items: [
        {
          title: t("common:overview.title"),
          icon: LayoutDashboard,
          link: linkOptions({
            to: "/workspaces/$workspaceId",
            params: { workspaceId },
            activeOptions: { exact: true },
          }),
        },
        ...(ability.can("read", "MemberApiKey")
          ? [
              {
                title: t("sidebar:navigation.api_keys"),
                icon: KeyRound,
                link: linkOptions({
                  to: "/workspaces/$workspaceId/api-keys",
                  params: { workspaceId },
                }),
              },
            ]
          : []),
        ...(ability.can("read", "Member")
          ? [
              {
                title: t("sidebar:navigation.members"),
                icon: User,
                link: linkOptions({
                  to: "/workspaces/$workspaceId/members",
                  params: { workspaceId },
                }),
              },
            ]
          : []),
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
    <AppSidebar {...props}>
      <SidebarContent>
        {sidebarGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      render={
                        <Link
                          {...item.link}
                          onClick={() => setOpenMobile(false)}
                        >
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
    </AppSidebar>
  );
};
