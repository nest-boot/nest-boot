import {
  Boxes,
  CircleUserRound,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { linkOptions } from "@tanstack/react-router";

import type { ComponentProps, ComponentType, FC } from "react";
import type { LinkProps } from "@tanstack/react-router";
import { useAbility } from "@/contexts/ability-context";
import { Link } from "@/components/link";
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

type SidebarItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  link: LinkProps;
  visible?: boolean;
};

export const UserSidebar: FC<ComponentProps<typeof Sidebar>> = (props) => {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const ability = useAbility();
  const items: Array<SidebarItem> = [
    {
      title: t("common:overview.title"),
      icon: LayoutDashboard,
      link: linkOptions({ to: "/user", activeOptions: { exact: true } }),
    },
    {
      title: t("sidebar:user.account"),
      icon: CircleUserRound,
      link: linkOptions({ to: "/user/profile" }),
    },
    {
      title: t("sidebar:user.api_keys"),
      icon: KeyRound,
      link: linkOptions({ to: "/user/api-keys" }),
      visible: ability.can("read", "UserApiKey"),
    },
    {
      title: t("sidebar:user.security"),
      icon: LockKeyhole,
      link: linkOptions({ to: "/user/security" }),
    },
    {
      title: t("sidebar:user.workspaces"),
      icon: Boxes,
      link: linkOptions({ to: "/user/workspaces" }),
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar:user.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.visible !== false)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
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
      </SidebarContent>
    </Sidebar>
  );
};
