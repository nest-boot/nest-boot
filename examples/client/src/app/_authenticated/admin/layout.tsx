import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";

import { AppTopbar } from "../components/app-topbar";
import { AdminSidebar } from "./components/admin-sidebar";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";

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
    <Layout>
      <AppTopbar />
      <AdminSidebar />
      <LayoutContent>
        <Outlet />
      </LayoutContent>
    </Layout>
  );
}
