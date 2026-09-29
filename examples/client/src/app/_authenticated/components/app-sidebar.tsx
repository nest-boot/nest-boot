import { useTranslation } from "react-i18next";
import { AppAccountMenu } from "./app-account-menu";
import type { ComponentProps } from "react";
import type { Workspace } from "@/components/thread-ui/sidebar-account-menu";
import {
  LayoutSidebar,
  LayoutSidebarHeader,
  LayoutSidebarLogo,
  LayoutSidebarTitle,
} from "@/components/thread-ui/layout";
import { SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { Link } from "@/components/link";
import { Logo } from "@/components/logo";

export function AppSidebar({
  workspace,
  children,
  ...props
}: ComponentProps<typeof LayoutSidebar> & { workspace?: Workspace }) {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  return (
    <LayoutSidebar collapsible="icon" {...props}>
      <LayoutSidebarHeader>
        <LayoutSidebarLogo>
          <Logo />
        </LayoutSidebarLogo>
        <LayoutSidebarTitle title={t("app.name")}>
          <Link
            to="/workspaces"
            onClick={() => setOpenMobile(false)}
            className="text-primary"
          >
            {t("app.name")}
          </Link>
        </LayoutSidebarTitle>
      </LayoutSidebarHeader>
      {children}
      <SidebarFooter>
        <AppAccountMenu workspace={workspace} />
      </SidebarFooter>
    </LayoutSidebar>
  );
}
