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
}

export function RecordNavigation({
  previousPath,
  nextPath,
  failed,
  onRetry,
}: RecordNavigationProps) {
  const { t } = useTranslation();
  return (
    <>
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          {t("common:navigation.failed")}
          <Button variant="outline" onClick={onRetry}>
            {t("common:navigation.retry")}
          </Button>
        </div>
      )}
      <PagePagination>
        <PagePreviousAction
          disabled={!previousPath}
          render={previousPath ? <Link to={previousPath} /> : undefined}
        />
        <PageNextAction
          disabled={!nextPath}
          render={nextPath ? <Link to={nextPath} /> : undefined}
        />
      </PagePagination>
    </>
  );
}
