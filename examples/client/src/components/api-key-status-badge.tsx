import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/thread-ui/badge";

interface ApiKeyStatusBadgeProps {
  apiKey: {
    enabled: boolean;
    expiresAt?: string | null;
  };
}

export function ApiKeyStatusBadge({ apiKey }: ApiKeyStatusBadgeProps) {
  const { t } = useTranslation("api-key");

  if (!apiKey.enabled) {
    return <Badge color="gray">{t("status.disabled")}</Badge>;
  }

  if (apiKey.expiresAt && dayjs(apiKey.expiresAt).isBefore(dayjs())) {
    return <Badge color="yellow">{t("status.expired")}</Badge>;
  }

  return <Badge color="green">{t("status.active")}</Badge>;
}
