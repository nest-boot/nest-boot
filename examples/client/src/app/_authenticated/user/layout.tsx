import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

import { AppTopbar } from "../components/app-topbar";
import { UserSidebar } from "./components/user-sidebar";
import { Layout, LayoutContent } from "@/components/thread-ui/layout";

export const Route = createFileRoute("/_authenticated/user")({
  component: UserLayout,
  beforeLoad: () => ({
    title: t("user:title"),
  }),
});

function UserLayout() {
  return (
    <Layout>
      <AppTopbar />
      <UserSidebar />

      <LayoutContent data-scroll-restoration-id="main-content">
        <Outlet />
      </LayoutContent>
    </Layout>
  );
}
