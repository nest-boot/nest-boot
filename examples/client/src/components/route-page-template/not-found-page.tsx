import { Empty } from "@/components/thread-ui/empty";
import { Link } from "@/components/link";

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Empty
        title="Not Found"
        description="The page you are looking for does not exist."
        primaryAction={{ label: "Go Home", render: <Link to="/" /> }}
      />
    </div>
  );
};
