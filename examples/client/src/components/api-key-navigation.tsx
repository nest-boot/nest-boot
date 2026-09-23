import { useTranslation } from "react-i18next";
import { Link } from "@/components/link";
import { Button } from "@/components/thread-ui/button";
import {
  PageNextAction,
  PagePagination,
  PagePreviousAction,
} from "@/components/thread-ui/page";

interface ApiKeyNavigationProps {
  previousPath?: string;
  nextPath?: string;
  failed: boolean;
  onRetry: () => void;
}

export function ApiKeyNavigation({
  previousPath,
  nextPath,
  failed,
  onRetry,
}: ApiKeyNavigationProps) {
  const { t } = useTranslation();
  return (
    <>
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          {t("api-key:navigation.failed")}
          <Button variant="outline" onClick={onRetry}>
            {t("api-key:navigation.retry")}
          </Button>
        </div>
      )}
      <PagePagination aria-label={t("api-key:navigation.label")}>
        <PagePreviousAction
          aria-label={t("api-key:navigation.previous")}
          data-testid="api-key-previous"
          disabled={!previousPath}
          render={previousPath ? <Link to={previousPath} /> : undefined}
        />
        <PageNextAction
          aria-label={t("api-key:navigation.next")}
          data-testid="api-key-next"
          disabled={!nextPath}
          render={nextPath ? <Link to={nextPath} /> : undefined}
        />
      </PagePagination>
    </>
  );
}
