import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import i18n from "i18next";
import { ThemeProvider } from "next-themes";
import { initReactI18next } from "react-i18next";
import { afterEach } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { AppProvider } from "@/components/thread-ui/app-provider";
import enAdmin from "../../public/locales/en/admin.json";
import enApiKey from "../../public/locales/en/api-key.json";
import enAuth from "../../public/locales/en/auth.json";
import enCommon from "../../public/locales/en/common.json";
import enPermission from "../../public/locales/en/permission.json";
import enSidebar from "../../public/locales/en/sidebar.json";
import enThreadUi from "../../public/locales/en/thread-ui.json";
import enUser from "../../public/locales/en/user.json";
import enWorkspaceMember from "../../public/locales/en/workspace-member.json";
import enWorkspace from "../../public/locales/en/workspace.json";
import zhAdmin from "../../public/locales/zh/admin.json";
import zhApiKey from "../../public/locales/zh/api-key.json";
import zhAuth from "../../public/locales/zh/auth.json";
import zhCommon from "../../public/locales/zh/common.json";
import zhPermission from "../../public/locales/zh/permission.json";
import zhSidebar from "../../public/locales/zh/sidebar.json";
import zhThreadUi from "../../public/locales/zh/thread-ui.json";
import zhUser from "../../public/locales/zh/user.json";
import zhWorkspaceMember from "../../public/locales/zh/workspace-member.json";
import zhWorkspace from "../../public/locales/zh/workspace.json";
import type { ReactNode } from "react";

let initialized = false;

export async function ensureTestI18n(language: "en" | "zh" = "en") {
  if (!initialized) {
    await i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: "en",
      defaultNS: "common",
      interpolation: { escapeValue: false },
      resources: {
        en: {
          common: enCommon,
          auth: enAuth,
          admin: enAdmin,
          sidebar: enSidebar,
          "api-key": enApiKey,
          permission: enPermission,
          workspace: enWorkspace,
          "workspace-member": enWorkspaceMember,
          user: enUser,
          "thread-ui": enThreadUi,
        },
        zh: {
          common: zhCommon,
          auth: zhAuth,
          admin: zhAdmin,
          sidebar: zhSidebar,
          "api-key": zhApiKey,
          permission: zhPermission,
          workspace: zhWorkspace,
          "workspace-member": zhWorkspaceMember,
          user: zhUser,
          "thread-ui": zhThreadUi,
        },
      },
    });
    initialized = true;
    return i18n;
  }
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  return i18n;
}

afterEach(async () => {
  await cleanup();
});

export async function renderWithRouter(
  renderContent: () => ReactNode,
  initialEntry = "/",
) {
  await cleanup();
  await ensureTestI18n("en");
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider attribute="class" defaultTheme="light">
        <AppProvider i18n={i18n}>
          <Outlet />
        </AppProvider>
      </ThemeProvider>
    ),
  });
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => <>{renderContent()}</>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{renderContent()}</>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, catchAllRoute]);
  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const router = createRouter({ routeTree, history });
  await router.load();
  const view = await render(<RouterProvider router={router} />);
  return {
    ...view,
    unmount: async () => {
      await view.unmount();
      view.container.remove();
    },
    router,
    history,
    i18n,
  };
}
