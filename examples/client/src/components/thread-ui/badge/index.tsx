"use client";

import { cva } from "class-variance-authority";
import type { ComponentProps, FC } from "react";
import type { VariantProps } from "class-variance-authority";

import { Badge as BaseBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const badgeVariants = cva("", {
  variants: {
    color: {
      red: "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
      orange:
        "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
      amber:
        "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
      yellow:
        "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
      lime: "border-lime-200 bg-lime-100 text-lime-800 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-200",
      green:
        "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
      emerald:
        "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
      teal: "border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
      cyan: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
      sky: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
      blue: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
      indigo:
        "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
      violet:
        "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
      purple:
        "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
      fuchsia:
        "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
      pink: "border-pink-200 bg-pink-100 text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200",
      rose: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
      slate:
        "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
      gray: "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200",
      zinc: "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
      neutral:
        "border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200",
      stone:
        "border-stone-200 bg-stone-100 text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200",
    },
  },
});

export type BadgeProps = ComponentProps<typeof BaseBadge> &
  VariantProps<typeof badgeVariants>;

export const Badge: FC<BadgeProps> = ({ color, className, ...props }) => (
  <BaseBadge className={cn(badgeVariants({ color }), className)} {...props} />
);
