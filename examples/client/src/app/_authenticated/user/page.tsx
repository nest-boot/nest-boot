import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Boxes, CircleUserRound, KeyRound, LockKeyhole } from "lucide-react";
import { useCurrentUserContext } from "../contexts/current-user-context";
import { Link } from "@/components/link";
import {
  OverviewCard,
  OverviewCount,
  OverviewError,
} from "@/components/overview-card";
import { Button } from "@/components/thread-ui/button";
import {
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { useAbility } from "@/contexts/ability-context";
import { graphql } from "@/gql";

const GET_OVERVIEW = graphql(`
  query getUserOverview($includeApiKeys: Boolean!) {
    currentUser {
      id
      workspaces(first: 1) {
        totalCount
        totalCountRelation
      }
      sessions(first: 1) {
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
export const Route = createFileRoute("/_authenticated/user/")({
  component: Overview,
  beforeLoad: () => ({ title: t("common:overview.title") }),
});
function Overview() {
  const { t } = useTranslation();
  const ability = useAbility();
  const user = useCurrentUserContext();
  const canReadApiKeys = ability.can("read", "UserApiKey");
  const { data, loading, error, refetch } = useQuery(GET_OVERVIEW, {
    variables: { includeApiKeys: canReadApiKeys },
    fetchPolicy: "network-only",
  });
  const summary = error ? undefined : data?.currentUser;
  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("common:overview.title")}</PageTitle>
        <PageDescription>
          {t("user:overview.description", { name: user.name })}
        </PageDescription>
      </PageHeader>
      <PageContent>
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
            <div className="grid gap-4 @3xl/page-layout:grid-cols-3">
              <OverviewCard
                title={t("user:workspaces.title")}
                description={t("user:overview.workspaces")}
                icon={<Boxes />}
                action={
                  <Button
                    variant="outline"
                    render={<Link to="/user/workspaces" />}
                  >
                    {t("sidebar:switcher.manageWorkspaces")}
                  </Button>
                }
              >
                <OverviewCount
                  connection={summary?.workspaces}
                  loading={loading}
                />
              </OverviewCard>

              {canReadApiKeys && (
                <OverviewCard
                  title={t("sidebar:user.api_keys")}
                  description={t("user:overview.api_keys")}
                  icon={<KeyRound />}
                  action={
                    <Button
                      variant="outline"
                      render={<Link to="/user/api-keys" />}
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
              <OverviewCard
                title={t("user:overview.sessions")}
                description={t("user:overview.security")}
                icon={<LockKeyhole />}
                action={
                  <Button
                    variant="outline"
                    render={<Link to="/user/security" />}
                  >
                    {t("user:overview.manage_security")}
                  </Button>
                }
              >
                <OverviewCount
                  connection={summary?.sessions}
                  loading={loading}
                />
              </OverviewCard>
            </div>
          </PageLayoutSection>
          <PageLayoutSection span="full">
            <OverviewCard
              title={t("user:profile.title")}
              description={t("user:profile.description")}
              icon={<CircleUserRound />}
              action={
                <Button variant="outline" render={<Link to="/user/profile" />}>
                  {t("user:overview.edit_profile")}
                </Button>
              }
            >
              <p>{user.name}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </OverviewCard>
          </PageLayoutSection>
        </PageLayout>
      </PageContent>
    </Page>
  );
}
