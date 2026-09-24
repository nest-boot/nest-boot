import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { KeyRound, UsersRound } from "lucide-react";
import { useCurrentWorkspaceContext } from "./contexts/current-workspace-context";
import { Link } from "@/components/link";
import {
  OverviewCard,
  OverviewCount,
  OverviewError,
} from "@/components/overview-card";
import { Button } from "@/components/thread-ui/button";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";

const GET_OVERVIEW = graphql(`
  query getWorkspaceOverview(
    $workspaceId: ID!
    $includeMembers: Boolean!
    $includeApiKeys: Boolean!
  ) {
    workspace(id: $workspaceId) {
      id
      members(first: 1) @include(if: $includeMembers) {
        totalCount
        totalCountRelation
      }
      apiKeys(first: 1) @include(if: $includeApiKeys) {
        totalCount
        totalCountRelation
      }
    }
  }
`);
export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/",
)({
  component: Overview,
  beforeLoad: () => ({ title: t("common:overview.title") }),
});
function Overview() {
  const { t } = useTranslation();
  const ability = useAbility();
  const workspace = useCurrentWorkspaceContext();
  const canReadMembers = ability.can("read", "Member");
  const canReadApiKeys = ability.can("read", "WorkspaceApiKey");
  const { data, loading, error, refetch } = useQuery(GET_OVERVIEW, {
    variables: {
      workspaceId: workspace.id,
      includeMembers: canReadMembers,
      includeApiKeys: canReadApiKeys,
    },
    context: { headers: { "x-workspace-id": workspace.id } },
    fetchPolicy: "network-only",
  });
  const summary =
    !error && data?.workspace?.id === workspace.id ? data.workspace : undefined;
  return (
    <Page
      title={t("common:overview.title")}
      description={t("workspace:overview.description", {
        name: workspace.name,
      })}
    >
      <PageLayout>
        {error && (
          <PageLayoutSection>
            <OverviewError
              onRetry={() => {
                void refetch().catch(() => undefined);
              }}
            />
          </PageLayoutSection>
        )}
        <PageLayoutSection>
          <div className="grid gap-4 @3xl/page-layout:grid-cols-2">
            {canReadMembers && (
              <OverviewCard
                title={t("sidebar:navigation.members")}
                description={t("workspace:overview.members")}
                icon={<UsersRound />}
                action={
                  <Button
                    variant="outline"
                    render={
                      <Link
                        to="/workspaces/$workspaceId/members"
                        params={{ workspaceId: workspace.id }}
                      />
                    }
                  >
                    {t("workspace:overview.manage_members")}
                  </Button>
                }
              >
                <OverviewCount
                  connection={summary?.members}
                  loading={loading}
                />
              </OverviewCard>
            )}
            {canReadApiKeys && (
              <OverviewCard
                title={t("sidebar:navigation.api_keys")}
                description={t("workspace:overview.api_keys")}
                icon={<KeyRound />}
                action={
                  <Button
                    variant="outline"
                    render={
                      <Link
                        to="/workspaces/$workspaceId/api-keys"
                        params={{ workspaceId: workspace.id }}
                      />
                    }
                  >
                    {t("common:overview.view_api_keys")}
                  </Button>
                }
              >
                <OverviewCount
                  connection={summary?.apiKeys}
                  loading={loading}
                />
              </OverviewCard>
            )}
          </div>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
