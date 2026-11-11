import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Bot, KeyRound, UsersRound } from "lucide-react";
import { useAbility } from "@/contexts/ability-context";
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
import { graphql } from "@/gql";

const GET_OVERVIEW = graphql(`
  query getAdminOverview($includeUsers: Boolean! = true) {
    users(first: 1) @include(if: $includeUsers) {
      totalCount
      totalCountRelation
    }
  }
`);
const SYSTEM_OVERVIEW = graphql(`
  query getAdminSystemAccountOverview {
    systemAccounts(first: 1) {
      totalCount
      totalCountRelation
    }
  }
`);
const KEY_OVERVIEW = graphql(`
  query getAdminSystemKeyOverview {
    systemApiKeys(first: 1) {
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
  const ability = useAbility();
  const canReadUsers = ability.can("read", "User");
  const { data, loading, error, refetch } = useQuery(GET_OVERVIEW, {
    fetchPolicy: "network-only",
    variables: { includeUsers: canReadUsers },
    skip: !canReadUsers,
  });
  const systemOverview = useQuery(SYSTEM_OVERVIEW, {
    fetchPolicy: "network-only",
    skip: !ability.can("read", "SystemAccount"),
  });
  const keyOverview = useQuery(KEY_OVERVIEW, {
    fetchPolicy: "network-only",
    skip: !ability.can("read", "SystemAccountApiKey"),
  });
  const summary = error ? undefined : data;
  return (
    <Page
      title={t("common:overview.title")}
      description={t("admin:overview.description")}
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
        {canReadUsers && (
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
        )}
        {ability.can("read", "SystemAccountApiKey") && (
          <PageLayoutSection>
            <OverviewCard
              title={t("api-key:title")}
              description={t("admin:system_accounts.keys_description")}
              icon={<KeyRound />}
              action={
                <Button
                  variant="outline"
                  render={<Link to="/admin/api-keys" />}
                >
                  {t("admin:system_accounts.manage_keys")}
                </Button>
              }
            >
              <OverviewCount
                connection={keyOverview.data?.systemApiKeys}
                loading={keyOverview.loading}
              />
              {keyOverview.error && (
                <OverviewError
                  onRetry={() => {
                    void keyOverview.refetch().catch(() => undefined);
                  }}
                />
              )}
            </OverviewCard>
          </PageLayoutSection>
        )}
        {ability.can("read", "SystemAccount") && (
          <PageLayoutSection>
            <OverviewCard
              title={t("admin:system_accounts.title")}
              description={t("admin:system_accounts.overview")}
              icon={<Bot />}
              action={
                <Button
                  variant="outline"
                  render={<Link to="/admin/system-accounts" />}
                >
                  {t("admin:system_accounts.manage")}
                </Button>
              }
            >
              {systemOverview.error ? (
                <OverviewError
                  onRetry={() => {
                    void systemOverview.refetch().catch(() => undefined);
                  }}
                />
              ) : (
                <OverviewCount
                  connection={systemOverview.data?.systemAccounts}
                  loading={systemOverview.loading}
                />
              )}
            </OverviewCard>
          </PageLayoutSection>
        )}
      </PageLayout>
    </Page>
  );
}
