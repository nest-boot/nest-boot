"use client";

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export type DataFilterRemoveActionProps = ComponentProps<typeof Button>;

export function DataFilterRemoveAction({
  children = <Trash2 />,
  ...props
}: DataFilterRemoveActionProps) {
  const { t } = useTranslation("thread-ui");

  return (
    <Button
      aria-label={t("dataFilter.removeFilter")}
      data-slot="data-filter-remove-action"
      size="icon-xs"
      type="button"
      variant="ghost"
      {...props}
    >
      {children}
    </Button>
  );
}
