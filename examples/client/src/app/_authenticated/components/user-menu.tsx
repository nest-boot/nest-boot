import { useApolloClient, useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { t } from "i18next";
import {
  Boxes,
  CircleUserRound,
  KeyRound,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { useAbility } from "@/contexts/ability-context";
import {
  TopbarMenuItem,
  TopbarMenuSeparator,
  TopbarMenuUser,
} from "@/components/thread-ui/topbar";
import { graphql } from "@/gql";

const AUTH_SIGN_OUT_FROM_SIDEBAR_USER = graphql(`
  mutation signOutFromSidebarUser {
    signOut
  }
`);

export function UserMenu() {
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const [signOut] = useMutation(AUTH_SIGN_OUT_FROM_SIDEBAR_USER);
  const ability = useAbility();

  return (
    <>
      <TopbarMenuUser />
      <TopbarMenuSeparator />
      <TopbarMenuItem
        data-testid="sidebar-user-account-link"
        onClick={() => navigate({ to: "/user" })}
      >
        <CircleUserRound />
        {t("sidebar:user.account")}
      </TopbarMenuItem>
      <TopbarMenuItem
        data-testid="sidebar-user-workspaces-link"
        onClick={() => navigate({ to: "/user/workspaces" })}
      >
        <Boxes />
        {t("sidebar:user.workspaces")}
      </TopbarMenuItem>
      {ability.can("read", "UserApiKey") ? (
        <TopbarMenuItem
          data-testid="sidebar-user-api-keys-link"
          onClick={() => navigate({ to: "/user/api-keys" })}
        >
          <KeyRound />
          {t("sidebar:user.api_keys")}
        </TopbarMenuItem>
      ) : null}
      {ability.can("read", "User") ? (
        <TopbarMenuItem
          data-testid="sidebar-admin-link"
          onClick={() => navigate({ to: "/admin/users" })}
        >
          <ShieldCheck />
          {t("sidebar:admin.title")}
        </TopbarMenuItem>
      ) : null}
      <TopbarMenuSeparator />
      <TopbarMenuItem
        data-testid="sidebar-user-sign-out"
        onClick={async () => {
          await signOut();
          await apolloClient.clearStore();
          await navigate({ to: "/auth/login" });
        }}
      >
        <LogOut />
        {t("sidebar:user.logout")}
      </TopbarMenuItem>
    </>
  );
}
