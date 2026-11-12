import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { ApiKeyStatusBadge } from "./api-key-status-badge";
import type { UserApiKey } from "@/gql/graphql";

interface ApiKeyMetadataProps {
  apiKey: Pick<
    UserApiKey,
    "revokedAt" | "expiresAt" | "createdAt" | "lastUsedAt"
  >;
}

/** Status and audit timestamps shared by all credential scopes. */
export function ApiKeyMetadata({ apiKey }: ApiKeyMetadataProps) {
  const { t } = useTranslation();
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground text-sm">
          {t("api-key:table.status")}
        </dt>
        <dd>
          <ApiKeyStatusBadge apiKey={apiKey} />
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-sm">
          {t("api-key:table.created_at")}
        </dt>
        <dd>{dayjs(apiKey.createdAt).format("YYYY-MM-DD HH:mm")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-sm">
          {t("api-key:table.last_used")}
        </dt>
        <dd>
          {apiKey.lastUsedAt
            ? dayjs(apiKey.lastUsedAt).format("YYYY-MM-DD HH:mm")
            : t("api-key:never_used")}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-sm">
          {t("api-key:table.expires_at")}
        </dt>
        <dd>
          {apiKey.expiresAt
            ? dayjs(apiKey.expiresAt).format("YYYY-MM-DD")
            : t("api-key:never_expires")}
        </dd>
      </div>
    </dl>
  );
}
