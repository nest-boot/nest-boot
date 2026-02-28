import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * Custom TypeDoc plugin that adds `title` frontmatter from the page name
 * @param {import("typedoc-plugin-markdown").MarkdownApplication} app
 */
export function load(app) {
  app.renderer.on(
    MarkdownPageEvent.BEGIN,
    /** @param {MarkdownPageEvent} page */
    (page) => {
      page.frontmatter = {
        title: page.model?.name,
        ...page.frontmatter,
      };
    },
  );
}
