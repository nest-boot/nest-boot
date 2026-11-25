import { createFileRoute } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Bot, KeyRound, UsersRound } from "lucide-react";
import { useAbility } from "@/contexts/ability-context";
import { Link } from "@/components/link";
import { OverviewCard } from "@/components/overview-card";
import { Button } from "@/components/thread-ui/button";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
  beforeLoad: () => ({ title: t("common:overview.title") }),
});
function Overview() {
  const { t } = useTranslation();
  const ability = useAbility();
  const canReadUsers = ability.can("read", "User");
  return (
    <Page
      title={t("common:overview.title")}
      description={t("admin:overview.description")}
    >
      <PageLayout>
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
            />
          </PageLayoutSection>
        )}
        {ability.can("read", "SystemApiKey") && (
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
            />
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
            />
          </PageLayoutSection>
        )}
      </PageLayout>
    </Page>
  );
}
