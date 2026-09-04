import { Outlet, createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys",
)({
  component: ApiKeysLayout,
  beforeLoad: () => {
    return {
      title: t("api-key:title"),
    };
  },
});

function ApiKeysLayout() {
  return <Outlet />;
}
