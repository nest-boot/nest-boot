import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

import { Layout, LayoutContent } from "@/components/thread-ui/layout";
import { UserSidebar } from "./components/user-sidebar";

export const Route = createFileRoute("/_authenticated/user")({
  component: UserLayout,
  beforeLoad: () => ({
    title: t("common:overview.title"),
  }),
});

function UserLayout() {
  return (
    <Layout>
      <UserSidebar />

      <LayoutContent>
        <Outlet />
      </LayoutContent>
    </Layout>
  );
}
