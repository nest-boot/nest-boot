"use client";

import { PanelLeftIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/thread-ui/button";
import { cn } from "@/lib/utils";

export type TopbarProps = ComponentProps<"header"> & {
  /** Omit to follow the application theme; set to force a light or dark header. */
  variant?: "light" | "dark";
};

export type TopbarBrandProps = ComponentProps<"div">;
export type TopbarSidebarTriggerProps = ComponentProps<typeof Button>;
export type TopbarActionGroupProps = ComponentProps<"div">;
export type TopbarActionProps = ComponentProps<typeof Button>;

export function TopbarBrand({ className, ...props }: TopbarBrandProps) {
  return (
    <div
      {...props}
      data-slot="topbar-brand"
      className={cn(
        "hidden max-w-full min-w-0 justify-self-start truncate font-semibold md:block",
        className,
      )}
    />
  );
}

/** Mobile navigation button connected to the nearest SidebarProvider. */
export function TopbarSidebarTrigger({
  className,
  children,
  onClick,
  ...props
}: TopbarSidebarTriggerProps) {
  const { openMobile, toggleSidebar } = useSidebar();
  const { t } = useTranslation("thread-ui");
  return (
    <Button
      aria-label={t("layout.toggleNavigation", "Toggle navigation")}
      size="icon"
      variant="ghost"
      {...props}
      aria-expanded={openMobile}
      data-slot="topbar-sidebar-trigger"
      className={cn(
        "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring aria-expanded:bg-accent aria-expanded:text-accent-foreground dark:hover:bg-accent size-10 shrink-0 justify-self-start focus-visible:border-transparent md:hidden",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggleSidebar();
      }}
    >
      {children ?? <PanelLeftIcon aria-hidden="true" />}
    </Button>
  );
}

export function TopbarActionGroup({
  className,
  ...props
}: TopbarActionGroupProps) {
  return (
    <div
      {...props}
      data-slot="topbar-action-group"
      className={cn(
        "flex min-w-0 items-center gap-1 justify-self-end sm:gap-2",
        className,
      )}
    />
  );
}

/** Icon action follows the top bar appearance; supply an accessible label. */
export function TopbarAction({ className, ...props }: TopbarActionProps) {
  return (
    <Button
      size="icon"
      variant="ghost"
      {...props}
      data-slot="topbar-action"
      className={cn(
        "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring aria-expanded:bg-accent aria-expanded:text-accent-foreground dark:hover:bg-accent size-10 shrink-0 focus-visible:border-transparent",
        className,
      )}
    />
  );
}

/** Compose the header with Topbar parts and application content. */
export function Topbar({
  variant,
  children,
  className,
  ...props
}: TopbarProps) {
  return (
    <header
      {...props}
      data-slot="topbar"
      data-variant={variant ?? "auto"}
      className={cn(
        "group/topbar border-border bg-topbar text-foreground z-20 grid h-14 min-w-0 shrink-0 auto-cols-[minmax(0,auto)] grid-flow-col grid-cols-[minmax(0,1fr)] items-center justify-items-end gap-2 border-b px-3 md:gap-4 md:px-4",
        className,
      )}
    >
      {children}
    </header>
  );
}
