import { useApolloClient, useMutation } from "@apollo/client/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import {
  Languages,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  SunMoon,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { useAbility } from "@/contexts/ability-context";
import {
  SidebarAccountMenuItem,
  SidebarAccountMenuRadioGroup,
  SidebarAccountMenuRadioItem,
  SidebarAccountMenuSeparator,
  SidebarAccountMenuSub,
  SidebarAccountMenuSubContent,
  SidebarAccountMenuSubTrigger,
} from "@/components/thread-ui/sidebar-account-menu";
import { graphql } from "@/gql";

const AUTH_SIGN_OUT_FROM_SIDEBAR_USER = graphql(`
  mutation signOutFromSidebarUser {
    signOut
  }
`);

export function UserMenu() {
  const { t, i18n } = useTranslation();
  const { theme = "system", setTheme } = useTheme();
  const router = useRouter();
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const [signOut] = useMutation(AUTH_SIGN_OUT_FROM_SIDEBAR_USER);
  const ability = useAbility();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarAccountMenuSeparator />
      <SidebarAccountMenuSub>
        <SidebarAccountMenuSubTrigger>
          <Languages />
          {t("thread-ui:sidebarAccountMenu.language")}
        </SidebarAccountMenuSubTrigger>
        <SidebarAccountMenuSubContent>
          <SidebarAccountMenuRadioGroup
            aria-label={t("thread-ui:sidebarAccountMenu.language")}
            value={i18n.resolvedLanguage ?? "en"}
            onValueChange={async (language) => {
              await i18n.changeLanguage(language);
              await router.invalidate();
            }}
          >
            <SidebarAccountMenuRadioItem value="zh" closeOnClick>
              简体中文
            </SidebarAccountMenuRadioItem>
            <SidebarAccountMenuRadioItem value="en" closeOnClick>
              English
            </SidebarAccountMenuRadioItem>
          </SidebarAccountMenuRadioGroup>
        </SidebarAccountMenuSubContent>
      </SidebarAccountMenuSub>
      <SidebarAccountMenuSub>
        <SidebarAccountMenuSubTrigger>
          <SunMoon />
          {t("thread-ui:sidebarAccountMenu.theme")}
        </SidebarAccountMenuSubTrigger>
        <SidebarAccountMenuSubContent>
          <SidebarAccountMenuRadioGroup
            aria-label={t("thread-ui:sidebarAccountMenu.theme")}
            value={theme}
            onValueChange={setTheme}
          >
            <SidebarAccountMenuRadioItem value="light" closeOnClick>
              <Sun />
              {t("sidebar:user.theme.light")}
            </SidebarAccountMenuRadioItem>
            <SidebarAccountMenuRadioItem value="dark" closeOnClick>
              <Moon />
              {t("sidebar:user.theme.dark")}
            </SidebarAccountMenuRadioItem>
            <SidebarAccountMenuRadioItem value="system" closeOnClick>
              <Monitor />
              {t("sidebar:user.theme.system")}
            </SidebarAccountMenuRadioItem>
          </SidebarAccountMenuRadioGroup>
        </SidebarAccountMenuSubContent>
      </SidebarAccountMenuSub>
      {ability.can("read", "User") ? (
        <>
          <SidebarAccountMenuSeparator />
          <SidebarAccountMenuItem
            onClick={() => {
              setOpenMobile(false);
              return navigate({ to: "/admin" });
            }}
          >
            <ShieldCheck />
            {t("sidebar:admin.title")}
          </SidebarAccountMenuItem>
        </>
      ) : null}
      <SidebarAccountMenuSeparator />
      <SidebarAccountMenuItem
        onClick={async () => {
          await signOut();
          await apolloClient.clearStore();
          await navigate({ to: "/auth/login" });
        }}
      >
        <LogOut />
        {t("sidebar:user.logout")}
      </SidebarAccountMenuItem>
    </>
  );
}
