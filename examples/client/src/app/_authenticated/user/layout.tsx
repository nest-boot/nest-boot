import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { Boxes } from "lucide-react";

import { Link } from "@/components/link";

export const Route = createFileRoute("/_authenticated/user")({
  component: UserLayout,
  beforeLoad: () => ({
    title: t("api-key:user.title"),
  }),
});

function UserLayout() {
  return (
    <div className="min-h-screen">
      <header className="bg-background flex h-16 items-center border-b px-6">
        <Link
          className="flex items-center gap-2 font-semibold"
          to="/workspaces"
        >
          <Boxes className="size-5" />
          {t("app.name")}
        </Link>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
