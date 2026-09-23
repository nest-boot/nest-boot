import { KeyRound, Settings, User } from "lucide-react";

import { linkOptions, useParams } from "@tanstack/react-router";
import { t } from "i18next";

import type { LinkProps } from "@tanstack/react-router";
import type { ComponentProps, ComponentType, FC } from "react";
import { useAbility } from "@/contexts/ability-context";
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
  const { setOpenMobile } = useSidebar();
  const ability = useAbility();

  const sidebarGroups: Array<{
    title: string;
    items: Array<SidebarItem>;
  }> = [
    {
      title: t("sidebar:navigation.settings"),
      items: [
        ...(ability.can("read", "WorkspaceApiKey")
          ? [
              {
                title: t("sidebar:navigation.api_keys"),
                icon: KeyRound,
                link: linkOptions({
                  to: "/workspaces/$workspaceId/api-keys",
                  params: { workspaceId },
                }),
                testId: "workspace-sidebar-api-keys-link",
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
    <Sidebar collapsible="offcanvas" {...props}>
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
                        <Link
                          {...item.link}
                          data-testid={item.testId}
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
    </Sidebar>
  );
};
