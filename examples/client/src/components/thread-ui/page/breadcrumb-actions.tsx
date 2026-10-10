"use client";

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
} from "react";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentProps, DOMAttributes, ReactNode, Ref } from "react";
import { Button } from "@/components/thread-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const BreadcrumbContext = createContext<boolean | null>(null);

function countActions(children: ReactNode): number {
  let count = 0;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      count += countActions((child.props as { children?: ReactNode }).children);
    } else {
      count += 1;
    }
  });
  return count;
}

export type BreadcrumbActionsProps = ComponentProps<"nav"> & {
  /** Accessible name for the button that opens the ancestor menu. */
  menuLabel?: string;
};

/** Compose ancestor destinations from the outermost to the nearest parent. */
export function BreadcrumbActions({
  children,
  className,
  menuLabel,
  ...props
}: BreadcrumbActionsProps) {
  const { t } = useTranslation("thread-ui");
  const count = countActions(children);
  if (count === 0) return null;
  const multiple = count > 1;
  return (
    <BreadcrumbContext.Provider value={multiple}>
      <nav
        aria-label={t("page.breadcrumbs", "Breadcrumbs")}
        {...props}
        data-slot="page-breadcrumb-actions"
        className={cn(
          "col-start-1 row-start-1 flex shrink-0 items-center gap-1 justify-self-start",
          className,
        )}
      >
        {multiple ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={
                      menuLabel ?? t("page.parentPages", "Parent pages")
                    }
                  >
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                }
              />
              <DropdownMenuContent
                align="start"
                className="w-auto max-w-[calc(100vw-2rem)] min-w-40"
              >
                {children}
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRightIcon
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
            />
          </>
        ) : (
          children
        )}
      </nav>
    </BreadcrumbContext.Provider>
  );
}

export type BreadcrumbActionProps = Omit<
  ComponentProps<typeof Button>,
  | keyof DOMAttributes<HTMLElement>
  | "className"
  | "size"
  | "variant"
  | "loading"
  | "type"
  | "ref"
> &
  DOMAttributes<HTMLElement> & {
    children: ReactNode;
    className?: string;
    ref?: Ref<HTMLElement>;
  };

/** A parent destination; render a framework Link or supply an onClick handler. */
export function BreadcrumbAction({
  children,
  className,
  nativeButton,
  ref,
  render,
  ...props
}: BreadcrumbActionProps) {
  const multiple = useContext(BreadcrumbContext);
  const handleRef = useCallback(
    (node: HTMLElement | null) => {
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );
  if (multiple === null) {
    throw new Error("BreadcrumbAction must be inside BreadcrumbActions.");
  }
  if (multiple) {
    return (
      <DropdownMenuItem
        ref={handleRef}
        {...props}
        className={cn("min-w-0", className)}
        data-slot="breadcrumb-action"
        nativeButton={nativeButton ?? false}
        render={render}
      >
        <span className="truncate">{children}</span>
      </DropdownMenuItem>
    );
  }
  return (
    <Button
      ref={handleRef}
      aria-label={typeof children === "string" ? children : undefined}
      role={(nativeButton ?? render == null) ? undefined : "link"}
      title={typeof children === "string" ? children : undefined}
      {...props}
      className={className}
      data-slot="breadcrumb-action"
      nativeButton={nativeButton ?? render == null}
      render={render}
      size="icon"
      type="button"
      variant="secondary"
    >
      <ArrowLeftIcon aria-hidden="true" className="rtl:rotate-180" />
      <span className="sr-only">{children}</span>
    </Button>
  );
}
