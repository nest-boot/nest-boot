import { useTranslation } from "react-i18next";
import type { RecordNavigationProps } from "@/components/record-navigation";
import { RecordNavigation } from "@/components/record-navigation";

type ApiKeyNavigationProps = Omit<
  RecordNavigationProps,
  "testIdPrefix" | "labels"
>;

export function ApiKeyNavigation(props: ApiKeyNavigationProps) {
  const { t } = useTranslation();
  return (
    <RecordNavigation
      {...props}
      testIdPrefix="api-key"
      labels={{
        label: t("api-key:navigation.label"),
        previous: t("api-key:navigation.previous"),
        next: t("api-key:navigation.next"),
        failed: t("api-key:navigation.failed"),
        retry: t("api-key:navigation.retry"),
      }}
    />
  );
}
