import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type FormLayoutProps = ComponentProps<"div">;

/** Arranges form fields without creating a form or taking over field semantics. */
export function FormLayout({ className, ...props }: FormLayoutProps) {
  return (
    <div
      {...props}
      data-slot="form-layout"
      className={cn(
        "@container/form-layout grid min-w-0 grid-cols-6 items-start gap-4",
        className,
      )}
    />
  );
}

const itemVariants = cva("col-span-full min-w-0", {
  variants: {
    span: {
      full: "",
      "1/2": "@lg/form-layout:col-span-3",
      "1/3": "@3xl/form-layout:col-span-2",
      "2/3": "@3xl/form-layout:col-span-4",
    },
  },
  defaultVariants: { span: "full" },
});

export type FormLayoutItemProps = ComponentProps<"div"> &
  VariantProps<typeof itemVariants>;

/** Wrap a field (including its label, description and error) as one grid item. */
export function FormLayoutItem({
  className,
  span,
  ...props
}: FormLayoutItemProps) {
  return (
    <div
      {...props}
      className={cn(itemVariants({ span }), className)}
      data-slot="form-layout-item"
    />
  );
}
