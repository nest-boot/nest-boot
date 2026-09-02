import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/link";

export const NotFoundPage = () => {
  return (
    <Empty className="flex h-screen w-full items-center justify-center">
      <EmptyHeader>
        <EmptyTitle>Not Found</EmptyTitle>
        <EmptyDescription>
          The page you are looking for does not exist.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <div className="flex gap-2">
          <Button render={<Link to="/">Go Home</Link>} />
        </div>
      </EmptyContent>
    </Empty>
  );
};
