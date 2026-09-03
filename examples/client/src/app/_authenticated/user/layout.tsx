import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

import { UserSidebar } from "./components/user-sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/user")({
  component: UserLayout,
  beforeLoad: () => ({
    title: t("user:title"),
  }),
});

function UserLayout() {
  return (
    <SidebarProvider>
      <UserSidebar />

      <SidebarInset>
        <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] duration-200 ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:left-(--sidebar-width) md:group-has-data-[collapsible=icon]/sidebar-wrapper:left-(--sidebar-width-icon)">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger />
            <Breadcrumbs />
          </div>
        </header>

        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
