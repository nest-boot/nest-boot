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

import { Link } from "@/components/link";
import { useAbility } from "@/contexts/ability-context";
import {
  TopbarMenuItem,
  TopbarMenuRadioGroup,
  TopbarMenuRadioItem,
  TopbarMenuSeparator,
  TopbarMenuSub,
  TopbarMenuSubContent,
  TopbarMenuSubTrigger,
  TopbarMenuUser,
} from "@/components/thread-ui/topbar";
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

  return (
    <>
      <TopbarMenuUser render={<Link to="/user/profile" />} />
      <TopbarMenuSeparator />
      <TopbarMenuSub>
        <TopbarMenuSubTrigger>
          <Languages />
          {t("thread-ui:topbarMenu.language")}
        </TopbarMenuSubTrigger>
        <TopbarMenuSubContent>
          <TopbarMenuRadioGroup
            aria-label={t("thread-ui:topbarMenu.language")}
            value={i18n.resolvedLanguage ?? "en"}
            onValueChange={async (language) => {
              await i18n.changeLanguage(language);
              await router.invalidate();
            }}
          >
            <TopbarMenuRadioItem value="zh" closeOnClick>
              简体中文
            </TopbarMenuRadioItem>
            <TopbarMenuRadioItem value="en" closeOnClick>
              English
            </TopbarMenuRadioItem>
          </TopbarMenuRadioGroup>
        </TopbarMenuSubContent>
      </TopbarMenuSub>
      <TopbarMenuSub>
        <TopbarMenuSubTrigger>
          <SunMoon />
          {t("thread-ui:topbarMenu.theme")}
        </TopbarMenuSubTrigger>
        <TopbarMenuSubContent>
          <TopbarMenuRadioGroup
            aria-label={t("thread-ui:topbarMenu.theme")}
            value={theme}
            onValueChange={setTheme}
          >
            <TopbarMenuRadioItem value="light" closeOnClick>
              <Sun />
              {t("sidebar:user.theme.light")}
            </TopbarMenuRadioItem>
            <TopbarMenuRadioItem value="dark" closeOnClick>
              <Moon />
              {t("sidebar:user.theme.dark")}
            </TopbarMenuRadioItem>
            <TopbarMenuRadioItem value="system" closeOnClick>
              <Monitor />
              {t("sidebar:user.theme.system")}
            </TopbarMenuRadioItem>
          </TopbarMenuRadioGroup>
        </TopbarMenuSubContent>
      </TopbarMenuSub>
      {ability.can("read", "User") ? (
        <>
          <TopbarMenuSeparator />
          <TopbarMenuItem onClick={() => navigate({ to: "/admin" })}>
            <ShieldCheck />
            {t("sidebar:admin.title")}
          </TopbarMenuItem>
        </>
      ) : null}
      <TopbarMenuSeparator />
      <TopbarMenuItem
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
