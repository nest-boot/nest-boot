// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const {
  themes: { github: lightCodeTheme, dracula: darkCodeTheme },
} = require("prism-react-renderer");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Nest Boot",
  tagline: "一个基于 NestJS 的快速开发脚手架",
  url: "https://nest-boot.vercel.app",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  organizationName: "nest-boot",
  projectName: "nest-boot",
  trailingSlash: false,

  i18n: {
    defaultLocale: "zh-Hans",
    locales: ["zh-Hans"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarCollapsed: false,
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/nest-boot/nest-boot/tree/master/apps/website/",
        },
        blog: {
          showReadingTime: true,
          editUrl:
            "https://github.com/nest-boot/nest-boot/tree/master/apps/website/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "Nest Boot",
        items: [
          {
            type: "doc",
            docId: "intro",
            position: "left",
            label: "文档",
          },
          {
            href: "https://github.com/nest-boot/nest-boot",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        copyright: `Copyright © ${new Date().getFullYear()} Nest Boot, Inc.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
