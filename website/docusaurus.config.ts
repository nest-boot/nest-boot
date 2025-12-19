import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const typedocPluginOptions = {
  entryPoints: ["../packages/*"],
  entryPointStrategy: "packages",
  exclude: [
    "../packages/eslint-config",
    "../packages/eslint-plugin",
    "../packages/tsconfig",
  ],
  packageOptions: {
    entryPoints: ["src/index.ts"],
    excludeInternal: true,
    excludePrivate: true,
  },
  out: "docs/api",
  sidebar: {
    autoConfiguration: true,
    pretty: true,
    typescript: true,
  },
  outputFileStrategy: "modules",
  useCodeBlocks: true,
  expandObjects: true,
  parametersFormat: "table",
  sanitizeComments: true,
  tableColumnSettings: {
    hideDefaults: true,
    hideInherited: true,
    hideModifiers: true,
    hideOverrides: true,
    hideSources: true,
  },
};

const config: Config = {
  title: "Nest Boot",
  tagline: "A modular framework for building NestJS applications",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://nest-boot.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  organizationName: "nest-boot",
  projectName: "nest-boot",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh-Hans"],
    localeConfigs: {
      en: {
        label: "English",
        htmlLang: "en-US",
      },
      "zh-Hans": {
        label: "简体中文",
        htmlLang: "zh-Hans",
      },
    },
  },

  plugins: [["docusaurus-plugin-typedoc", typedocPluginOptions]],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/nest-boot/nest-boot/tree/master/website/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Nest Boot",
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          to: "/docs/api",
          label: "API",
          position: "left",
        },
        {
          href: "https://github.com/nest-boot/nest-boot",
          label: "GitHub",
          position: "right",
        },
        {
          type: "localeDropdown",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/docs/intro",
            },
            {
              label: "API Reference",
              to: "/docs/api",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/nest-boot/nest-boot",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Nest Boot.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
