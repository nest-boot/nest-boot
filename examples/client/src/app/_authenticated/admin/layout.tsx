import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

import { AdminSidebar } from "./components/admin-sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  beforeLoad: ({ context: { ability } }) => {
    if (!ability.can("read", "User")) {
      throw redirect({ to: "/user" });
    }
    return { title: t("admin:title") };
  },
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b">
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
