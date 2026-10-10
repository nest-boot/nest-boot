import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { TotalCountRelation } from "@/gql/graphql";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/thread-ui/button";

export function OverviewCard({
  title,
  description,
  icon,
  children,
  action,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>{icon}</CardAction>
      </CardHeader>
      <div className="flex-1">
        <CardContent>{children}</CardContent>
      </div>
      <CardFooter>{action}</CardFooter>
    </Card>
  );
}

export function OverviewCount({
  connection,
  loading,
}: {
  connection?: { totalCount: number; totalCountRelation: TotalCountRelation };
  loading: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (loading) return <p role="status">{t("common:overview.loading")}</p>;
  return (
    <p className="text-3xl font-semibold tabular-nums">
      {connection
        ? `${new Intl.NumberFormat(i18n.resolvedLanguage).format(connection.totalCount)}${connection.totalCountRelation === "GTE" ? "+" : ""}`
        : "—"}
    </p>
  );
}

export function OverviewError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("common:overview.failed")}</AlertTitle>
      <AlertDescription>
        <Button variant="outline" onClick={onRetry}>
          {t("common:navigation.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
