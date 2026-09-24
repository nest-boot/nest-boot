import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { UsersRound } from "lucide-react";
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
import { graphql } from "@/gql";

const GET_OVERVIEW = graphql(`
  query getAdminOverview {
    users(first: 1) {
      totalCount
      totalCountRelation
    }
  }
`);
export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
  beforeLoad: () => ({ title: t("common:overview.title") }),
});
function Overview() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery(GET_OVERVIEW, {
    fetchPolicy: "network-only",
  });
  const summary = error ? undefined : data;
  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("common:overview.title")}</PageTitle>
        <PageDescription>{t("admin:overview.description")}</PageDescription>
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
            <OverviewCard
              title={t("sidebar:admin.users")}
              description={t("admin:overview.users")}
              icon={<UsersRound />}
              action={
                <Button variant="outline" render={<Link to="/admin/users" />}>
                  {t("admin:overview.manage_users")}
                </Button>
              }
            >
              <OverviewCount connection={summary?.users} loading={loading} />
            </OverviewCard>
          </PageLayoutSection>
        </PageLayout>
      </PageContent>
    </Page>
  );
}
