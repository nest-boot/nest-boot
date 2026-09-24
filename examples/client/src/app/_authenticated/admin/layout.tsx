import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppTopbar } from "../components/app-topbar";
import { AdminSidebar } from "./components/admin-sidebar";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  beforeLoad: ({ context: { ability } }) => {
    if (!ability.can("read", "User")) {
      throw redirect({ to: "/user" });
    }
  },
});

function AdminLayout() {
  return (
    <Layout>
      <AppTopbar />
      <AdminSidebar />
      <LayoutContent data-scroll-restoration-id="main-content">
        <Outlet />
      </LayoutContent>
    </Layout>
  );
}
