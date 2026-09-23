import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@/components/link";
import { Button } from "@/components/thread-ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

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
    <div className="flex flex-wrap items-center gap-2">
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          {t("api-key:navigation.failed")}
          <Button variant="outline" onClick={onRetry}>
            {t("api-key:navigation.retry")}
          </Button>
        </div>
      )}
      <ButtonGroup aria-label={t("api-key:navigation.label")}>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("api-key:navigation.previous")}
          data-testid="api-key-previous"
          disabled={!previousPath}
          render={previousPath ? <Link to={previousPath} /> : undefined}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("api-key:navigation.next")}
          data-testid="api-key-next"
          disabled={!nextPath}
          render={nextPath ? <Link to={nextPath} /> : undefined}
        >
          <ChevronRight />
        </Button>
      </ButtonGroup>
    </div>
  );
}
