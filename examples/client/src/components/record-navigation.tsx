import { Link } from "@/components/link";
import {
  PageNextAction,
  PagePagination,
  PagePreviousAction,
} from "@/components/thread-ui/page";

export interface RecordNavigationProps {
  previousPath?: string;
  nextPath?: string;
}

export function RecordNavigation({
  previousPath,
  nextPath,
}: RecordNavigationProps) {
  return (
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
  );
}
