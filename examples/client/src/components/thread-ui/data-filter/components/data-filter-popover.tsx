"use client";

import type { ComponentProps } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DataFilterPopoverProps = ComponentProps<typeof Popover>;

export function DataFilterPopover(props: DataFilterPopoverProps) {
  return <Popover {...props} />;
}

export type DataFilterPopoverTriggerProps = ComponentProps<
  typeof PopoverTrigger
>;

export function DataFilterPopoverTrigger(props: DataFilterPopoverTriggerProps) {
  return <PopoverTrigger data-slot="data-filter-popover-trigger" {...props} />;
}

export type DataFilterPopoverContentProps = ComponentProps<
  typeof PopoverContent
>;

export function DataFilterPopoverContent({
  className,
  align = "start",
  ...props
}: DataFilterPopoverContentProps) {
  return (
    <PopoverContent
      align={align}
      data-slot="data-filter-popover-content"
      className={cn(
        "grid w-fit max-w-64 min-w-48 gap-1 rounded-2xl p-2",
        className,
      )}
      {...props}
    />
  );
}

export type DataFilterPopoverHeaderProps = ComponentProps<"div">;

export function DataFilterPopoverHeader({
  className,
  ...props
}: DataFilterPopoverHeaderProps) {
  return (
    <div
      data-slot="data-filter-popover-header"
      className={cn(
        "flex min-w-0 items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

export type DataFilterPopoverBodyProps = ComponentProps<"div">;

export function DataFilterPopoverBody({
  className,
  ...props
}: DataFilterPopoverBodyProps) {
  return (
    <div
      className={cn("grid min-w-0 gap-2", className)}
      data-slot="data-filter-popover-body"
      {...props}
    />
  );
}
