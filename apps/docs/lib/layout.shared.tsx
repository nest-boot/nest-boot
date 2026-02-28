import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { i18n } from "@/lib/i18n";

export const gitConfig = {
  user: "nest-boot",
  repo: "nest-boot",
  branch: "master",
};

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n,
    nav: {
      title: "Nest Boot",
    },
    links: [
      {
        text: "Docs",
        url: "/docs",
        active: "nested-url",
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
