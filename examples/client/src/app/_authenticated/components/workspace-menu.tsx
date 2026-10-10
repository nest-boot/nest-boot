import { Loader2 } from "lucide-react";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

import type { Workspace } from "@/components/thread-ui/sidebar-account-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "@/components/link";
import { SidebarAccountMenuItem } from "@/components/thread-ui/sidebar-account-menu";
import { graphql } from "@/gql";
import { toast } from "@/components/thread-ui/toast";

const GET_WORKSPACES_FROM_WORKSPACE_SWITCHER = graphql(`
  query getWorkspacesFromWorkspaceSwitcher(
    $first: Int
    $after: String
    $before: String
    $query: String
    $orderBy: WorkspaceOrder
  ) {
    currentUser {
      workspaces(
        first: $first
        after: $after
        before: $before
        query: $query
        orderBy: $orderBy
      ) {
        edges {
          node {
            id
            name
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  }
`);

export function WorkspaceMenu({
  onWorkspacesChange,
}: {
  onWorkspacesChange: (workspaces: Array<Workspace>) => void;
}) {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const [loadingMore, setLoadingMore] = useState(false);
  // The popup unmounts when closed. Each opening owns a fresh, uncached result,
  // so membership changes and late pages from a previous opening cannot leak in.
  const { data, loading, error, fetchMore, refetch } = useQuery(
    GET_WORKSPACES_FROM_WORKSPACE_SWITCHER,
    { variables: { first: 10 }, fetchPolicy: "no-cache" },
  );
  const connection = data?.currentUser.workspaces;
  useEffect(() => {
    onWorkspacesChange(
      connection?.edges.map(({ node: workspace }) => ({
        ...workspace,
        render: (
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId: workspace.id }}
            onClick={() => setOpenMobile(false)}
          />
        ),
      })) ?? [],
    );
  }, [connection, onWorkspacesChange, setOpenMobile]);

  const handleLoadMore = async () => {
    if (loadingMore || !connection?.pageInfo.hasNextPage) return;
    const after = connection.pageInfo.endCursor;
    if (!after) return;

    setLoadingMore(true);
    try {
      await fetchMore({
        variables: { after },
        updateQuery(previous, { fetchMoreResult }) {
          const current = previous.currentUser.workspaces;
          const incoming = fetchMoreResult.currentUser.workspaces;
          return {
            ...fetchMoreResult,
            currentUser: {
              ...fetchMoreResult.currentUser,
              workspaces: {
                ...incoming,
                edges: [
                  ...new Map(
                    [...current.edges, ...incoming.edges].map((edge) => [
                      edge.node.id,
                      edge,
                    ]),
                  ).values(),
                ],
                pageInfo: {
                  ...incoming.pageInfo,
                  startCursor: current.pageInfo.startCursor,
                  hasPreviousPage: current.pageInfo.hasPreviousPage,
                },
              },
            },
          };
        },
      });
    } catch {
      toast.add({ type: "error", title: t("sidebar:switcher.loadFailed") });
    } finally {
      // Always release the action, including when fetchMore rejects.
      setLoadingMore(false);
    }
  };

  return (
    <>
      {loading && !data ? (
        <SidebarAccountMenuItem disabled>
          <Loader2 className="animate-spin" />
          {t("sidebar:switcher.loading")}
        </SidebarAccountMenuItem>
      ) : error && !data ? (
        <SidebarAccountMenuItem
          closeOnClick={false}
          onClick={() => void refetch().catch(() => undefined)}
        >
          {t("sidebar:switcher.retry")}
        </SidebarAccountMenuItem>
      ) : null}
      {connection?.pageInfo.hasNextPage ? (
        <SidebarAccountMenuItem
          disabled={loadingMore}
          closeOnClick={false}
          onClick={() => void handleLoadMore()}
        >
          {loadingMore ? <Loader2 className="animate-spin" /> : null}
          {t("sidebar:switcher.loadMore")}
        </SidebarAccountMenuItem>
      ) : null}
    </>
  );
}
