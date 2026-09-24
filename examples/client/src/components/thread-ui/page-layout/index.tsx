import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type PageLayoutProps = ComponentProps<"div">;

/** Arranges sections using the available container width, independently of Page. */
export function PageLayout({ className, ...props }: PageLayoutProps) {
  return (
    <div
      {...props}
      data-slot="page-layout"
      className={cn(
        "@container/page-layout grid min-w-0 grid-cols-6 items-start gap-4",
        className,
      )}
    />
  );
}

const sectionVariants = cva("col-span-full min-w-0 space-y-4", {
  variants: {
    span: {
      full: "",
      "1/2": "@3xl/page-layout:col-span-3",
      "1/3": "@3xl/page-layout:col-span-2",
      "2/3": "@3xl/page-layout:col-span-4",
    },
  },
  defaultVariants: {
    span: "full",
  },
});

export type PageLayoutSectionProps = ComponentProps<"div"> &
  VariantProps<typeof sectionVariants>;

export function PageLayoutSection({
  className,
  span,
  ...props
}: PageLayoutSectionProps) {
  return (
    <div
      {...props}
      className={cn(sectionVariants({ span }), className)}
      data-slot="page-layout-section"
    />
  );
}
