import { Link } from "@tanstack/react-router";
import { t } from "i18next";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarLogo() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={
            <Link to="/">
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
  );
}
