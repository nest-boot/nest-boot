import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Button } from "@/components/thread-ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  children?: ReactNode;
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
      {children && <CardContent>{children}</CardContent>}
      <CardFooter>{action}</CardFooter>
    </Card>
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
