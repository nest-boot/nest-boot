import { Loader2 } from "lucide-react";
import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";

import { Link } from "@/components/link";
import {
  TopbarMenuItem,
  TopbarMenuSeparator,
  TopbarMenuWorkspaceGroup,
  TopbarMenuWorkspaceItem,
  TopbarMenuWorkspaceLabel,
} from "@/components/thread-ui/topbar";
import { graphql } from "@/gql";

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
  currentWorkspaceId,
}: {
  currentWorkspaceId?: string;
}) {
  const { t } = useTranslation();
  const [loadingMore, setLoadingMore] = useState(false);
  const [additionalWorkspaces, setAdditionalWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [additionalPageInfo, setAdditionalPageInfo] = useState<{
    endCursor?: string | null;
    hasNextPage: boolean;
  }>();

  const { data, fetchMore } = useQuery(GET_WORKSPACES_FROM_WORKSPACE_SWITCHER, {
    variables: { first: 10 },
  });

  const workspaces = useMemo(() => {
    const byId = new Map(
      [
        ...(data?.currentUser.workspaces.edges.map(({ node }) => node) ?? []),
        ...additionalWorkspaces,
      ].map((workspace) => [workspace.id, workspace]),
    );
    return [...byId.values()];
  }, [additionalWorkspaces, data]);
  const handleLoadMore = async () => {
    const endCursor =
      additionalPageInfo?.endCursor ??
      data?.currentUser.workspaces.pageInfo.endCursor;
    if (!endCursor) return;

    setLoadingMore(true);
    try {
      const result = await fetchMore({
        variables: { after: endCursor, first: 10 },
      });
      setAdditionalWorkspaces((current) => [
        ...current,
        ...result.data.currentUser.workspaces.edges.map(({ node }) => node),
      ]);
      setAdditionalPageInfo(result.data.currentUser.workspaces.pageInfo);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <TopbarMenuWorkspaceGroup value={currentWorkspaceId ?? ""}>
        <TopbarMenuWorkspaceLabel />
        {workspaces.map((workspace) => (
          <TopbarMenuWorkspaceItem
            key={workspace.id}
            workspace={workspace}
            render={
              <Link
                to="/workspaces/$workspaceId"
                params={{ workspaceId: workspace.id }}
                data-testid={`workspace-switcher-workspace-${workspace.id}`}
              />
            }
          />
        ))}
      </TopbarMenuWorkspaceGroup>
      {(additionalPageInfo?.hasNextPage ??
      data?.currentUser.workspaces.pageInfo.hasNextPage) ? (
        <TopbarMenuItem
          disabled={loadingMore}
          data-testid="workspace-switcher-load-more"
          closeOnClick={false}
          onClick={() => void handleLoadMore()}
        >
          {loadingMore ? <Loader2 className="animate-spin" /> : null}
          {t("sidebar:switcher.loadMore")}
        </TopbarMenuItem>
      ) : null}
      <TopbarMenuSeparator />
      <TopbarMenuItem
        render={<Link to="/user/workspaces" />}
        data-testid="workspace-switcher-manage"
      >
        {t("sidebar:switcher.manageWorkspaces")}
      </TopbarMenuItem>
    </>
  );
}
