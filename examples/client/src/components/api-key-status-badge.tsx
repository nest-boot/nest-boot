import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";

import { Badge } from "@/components/thread-ui/badge";

interface ApiKeyStatusBadgeProps extends Omit<
  ComponentProps<typeof Badge>,
  "children" | "color"
> {
  apiKey: {
    enabled: boolean;
    expiresAt?: string | null;
  };
}

export function ApiKeyStatusBadge({
  apiKey,
  ...props
}: ApiKeyStatusBadgeProps) {
  const { t } = useTranslation("api-key");

  if (!apiKey.enabled) {
    return (
      <Badge {...props} color="gray">
        {t("status.disabled")}
      </Badge>
    );
  }

  if (apiKey.expiresAt && dayjs(apiKey.expiresAt).isBefore(dayjs())) {
    return (
      <Badge {...props} color="yellow">
        {t("status.expired")}
      </Badge>
    );
  }

  return (
    <Badge {...props} color="green">
      {t("status.active")}
    </Badge>
  );
}
