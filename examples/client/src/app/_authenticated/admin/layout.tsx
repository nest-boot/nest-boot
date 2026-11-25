import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import { AdminSidebar } from "./components/admin-sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  beforeLoad: ({ context: { ability } }) => {
    if (
      !ability.can("read", "User") &&
      !ability.can("read", "SystemAccount") &&
      !ability.can("read", "SystemApiKey")
    ) {
      throw redirect({ to: "/user" });
    }
  },
});

function AdminLayout() {
  return (
    <Layout>
      <AdminSidebar />
      <LayoutContent>
        <Outlet />
      </LayoutContent>
    </Layout>
  );
}
