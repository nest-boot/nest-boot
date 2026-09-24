"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type LayoutProps = ComponentProps<"div">;
export type LayoutContentProps = ComponentProps<"main">;

const LayoutContext = createContext<{
  defaultContentId: string;
  registerContent: (id: string | undefined) => void;
} | null>(null);

function LayoutSidebarState() {
  const { isMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (!isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  return null;
}

/** Grid application shell. Compose Topbar, shadcn Sidebar, and LayoutContent directly. */
export function Layout({ children, className, ...props }: LayoutProps) {
  const { t } = useTranslation("thread-ui");
  const id = useId();
  const defaultContentId = `${id}-main`;
  const [contentId, registerContent] = useState<string>();
  const context = useMemo(
    () => ({ defaultContentId, registerContent }),
    [defaultContentId],
  );
  return (
    <LayoutContext.Provider value={context}>
      <SidebarProvider
        {...props}
        data-slot="layout"
        open={true}
        className={cn(
          "bg-canvas isolate grid h-svh min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] overflow-hidden",
          "[&>[data-slot=topbar]]:col-span-full [&>[data-slot=topbar]]:row-start-1",
          "[&>[data-slot=sidebar]]:relative [&>[data-slot=sidebar]]:col-start-1 [&>[data-slot=sidebar]]:row-start-2 [&>[data-slot=sidebar]]:min-h-0 [&>[data-slot=sidebar][data-side=right]]:col-start-3",
          "[&>[data-slot=sidebar]>[data-slot=sidebar-container]]:absolute [&>[data-slot=sidebar]>[data-slot=sidebar-container]]:inset-0 [&>[data-slot=sidebar]>[data-slot=sidebar-container]]:h-full [&>[data-slot=sidebar]>[data-slot=sidebar-container]]:w-full",
          className,
        )}
      >
        <LayoutSidebarState />
        {contentId && (
          <a
            className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:rounded-lg focus:p-3"
            href={`#${contentId}`}
            onClick={(event) => {
              event.preventDefault();
              event.currentTarget.ownerDocument
                .getElementById(contentId)
                ?.focus();
            }}
          >
            {t("layout.skipToContent", "Skip to content")}
          </a>
        )}
        {children}
      </SidebarProvider>
    </LayoutContext.Provider>
  );
}

/** Independently scrolling main landmark; refs and events target its viewport. */
export function LayoutContent({
  id: suppliedId,
  className,
  children,
  ...props
}: LayoutContentProps) {
  const context = useContext(LayoutContext);
  if (!context) throw new Error("LayoutContent must be inside Layout.");
  const { defaultContentId, registerContent } = context;
  const id = suppliedId ?? defaultContentId;
  useEffect(() => {
    registerContent(id);
    return () => registerContent(undefined);
  }, [id, registerContent]);
  return (
    <ScrollArea.Root
      className="relative col-start-2 row-start-2 min-h-0 min-w-0 overflow-hidden"
      data-slot="layout-content"
    >
      <ScrollArea.Viewport
        role="main"
        render={
          <main
            tabIndex={-1}
            {...props}
            id={id}
            className={cn(
              "bg-canvas focus-visible:ring-ring/50 block size-full min-h-0 min-w-0 overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset",
              className,
            )}
          />
        }
      >
        <ScrollArea.Content className="flex min-h-full min-w-0! flex-col">
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
