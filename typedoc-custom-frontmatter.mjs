import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * Custom TypeDoc plugin that adds metadata derived from the page name.
 * @param {import("typedoc-plugin-markdown").MarkdownApplication} app
 */
export function load(app) {
  app.renderer.on(
    MarkdownPageEvent.BEGIN,
    /** @param {MarkdownPageEvent} page */
    (page) => {
      const title = page.model?.name;

      page.frontmatter = {
        title,
        description:
          typeof title === "string" ? `API reference for ${title}.` : undefined,
        ...page.frontmatter,
      };
    },
  );
}
