# Nest Boot documentation site

This Next.js/Fumadocs application serves the Nest Boot tutorials and generated API reference.

## Local development

From the repository root:

```bash
pnpm install
pnpm dev:docs
```

The development server prints its local URL. English pages live under `/en/docs`; Simplified Chinese pages live under `/zh-Hans/docs`.

## Documentation sources

- `content/docs/index*.mdx`: localized introduction pages
- `content/docs/tutorial/*.mdx`: hand-written tutorials
- `content/docs/api/*.mdx`: generated TypeDoc API pages; do not edit these by hand
- `source.config.ts`: Fumadocs collections and frontmatter processing
- `../../typedoc.json`: TypeDoc package selection and Markdown output configuration
- `../../typedoc-custom-frontmatter.mjs`: frontmatter added to generated API pages

After changing a package's public API or TSDoc, regenerate the API reference from the repository root:

```bash
pnpm docs:generate
```

## Machine-readable routes

The site exposes the same content to tools and coding agents:

| Route                   | Content                                                |
| ----------------------- | ------------------------------------------------------ |
| `/llms.txt`             | English documentation page index                       |
| `/llms-full.txt`        | All English documentation as Markdown                  |
| `/llms.mdx/docs/<slug>` | One documentation page as Markdown                     |
| `/docs/<slug>.mdx`      | Markdown alternative for a localized documentation URL |
| `/robots.txt`           | Crawler policy and sitemap location                    |
| `/sitemap.xml`          | Localized pages and API reference URLs                 |

## Validation

```bash
pnpm --filter @nest-boot/docs types:check
pnpm --filter @nest-boot/docs lint
pnpm build:docs
```
