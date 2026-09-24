"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import type { PageActionProps } from "./index";
import { Button } from "@/components/thread-ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";

export type PagePaginationProps = Omit<
  ComponentProps<typeof ButtonGroup>,
  "orientation"
>;

/** Place after the primary action inside PageActions. Hidden in narrow pages. */
export function PagePagination({ className, ...props }: PagePaginationProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <ButtonGroup
      aria-label={t("page.pagination", "Item navigation")}
      {...props}
      className={cn("order-last hidden shrink-0 @2xl/page:flex", className)}
      data-slot="page-pagination"
      orientation="horizontal"
    />
  );
}

export type PagePaginationActionProps = Omit<
  PageActionProps,
  "children" | "type"
>;
export type PagePreviousActionProps = PagePaginationActionProps;
export type PageNextActionProps = PagePaginationActionProps;

export function PagePreviousAction({
  nativeButton,
  render,
  ...props
}: PagePreviousActionProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <Button
      aria-label={t("page.previousItem", "Previous item")}
      role={(nativeButton ?? render == null) ? undefined : "link"}
      {...props}
      nativeButton={nativeButton ?? render == null}
      render={render}
      size="icon"
      type="button"
      variant="secondary"
    >
      <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
    </Button>
  );
}

export function PageNextAction({
  nativeButton,
  render,
  ...props
}: PageNextActionProps) {
  const { t } = useTranslation("thread-ui");
  return (
    <Button
      aria-label={t("page.nextItem", "Next item")}
      role={(nativeButton ?? render == null) ? undefined : "link"}
      {...props}
      nativeButton={nativeButton ?? render == null}
      render={render}
      size="icon"
      type="button"
      variant="secondary"
    >
      <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
    </Button>
  );
}
