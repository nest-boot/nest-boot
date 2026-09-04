import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { t } from "i18next";

import appCss from "../styles.css?url";
import type i18n from "i18next";
import type { ApolloClientIntegration } from "@apollo/client-integration-tanstack-start";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/components/thread-ui/app-provider";
import i18next from "@/lib/i18n";

export const Route = createRootRouteWithContext<
  ApolloClientIntegration.RouterContext & {
    i18n: typeof i18n;
    title?: string;
  }
>()({
  ssr: false,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: t("app.name"),
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/logo.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body className="bg-background min-h-screen">
        <AppProvider i18n={i18next}>
          <TooltipProvider>{children}</TooltipProvider>
        </AppProvider>

        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />

        <Scripts />
      </body>
    </html>
  );
}
