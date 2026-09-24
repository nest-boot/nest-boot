import { useTranslation } from "react-i18next";
import { Link } from "@/components/link";
import { Button } from "@/components/thread-ui/button";
import {
  PageNextAction,
  PagePagination,
  PagePreviousAction,
} from "@/components/thread-ui/page";

export interface RecordNavigationProps {
  previousPath?: string;
  nextPath?: string;
  failed: boolean;
  onRetry: () => void;
  testIdPrefix: string;
  labels?: {
    label: string;
    previous: string;
    next: string;
    failed: string;
    retry: string;
  };
}

export function RecordNavigation({
  previousPath,
  nextPath,
  failed,
  onRetry,
  testIdPrefix,
  labels,
}: RecordNavigationProps) {
  const { t } = useTranslation();
  return (
    <>
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          {labels?.failed ?? t("common:navigation.failed")}
          <Button variant="outline" onClick={onRetry}>
            {labels?.retry ?? t("common:navigation.retry")}
          </Button>
        </div>
      )}
      <PagePagination
        aria-label={labels?.label ?? t("thread-ui:page.pagination")}
      >
        <PagePreviousAction
          aria-label={labels?.previous ?? t("thread-ui:page.previousItem")}
          data-testid={`${testIdPrefix}-previous`}
          disabled={!previousPath}
          render={previousPath ? <Link to={previousPath} /> : undefined}
        />
        <PageNextAction
          aria-label={labels?.next ?? t("thread-ui:page.nextItem")}
          data-testid={`${testIdPrefix}-next`}
          disabled={!nextPath}
          render={nextPath ? <Link to={nextPath} /> : undefined}
        />
      </PagePagination>
    </>
  );
}
