# Nest Boot documentation site

This Next.js/Fumadocs application serves the Nest Boot guides and tutorials.

## Local development

From the repository root:

```bash
pnpm install
pnpm dev:docs
```

The development server prints its local URL. English pages live under `/en/docs`; Simplified Chinese pages live under `/zh-Hans/docs`.

## Documentation sources

- `content/docs/index*.mdx`: localized introduction pages
- `content/docs/tutorial/**/*.mdx`: hand-written tutorials
- `source.config.ts`: Fumadocs collections and frontmatter processing

Document concepts, configuration, usage examples, and migration guidance here. Update the relevant tutorials when behavior changes.

Read `../../packages/<package>/src/index.ts`, the implementation, and its source comments for exact exports, types, and method signatures. The documentation site builds directly from the hand-written content.

## Machine-readable routes

The site exposes the same content to tools and coding agents:

| Route                   | Content                                                |
| ----------------------- | ------------------------------------------------------ |
| `/llms.txt`             | English documentation page index                       |
| `/llms-full.txt`        | All English documentation as Markdown                  |
| `/llms.mdx/docs/<slug>` | One documentation page as Markdown                     |
| `/docs/<slug>.mdx`      | Markdown alternative for a localized documentation URL |
| `/robots.txt`           | Crawler policy and sitemap location                    |
| `/sitemap.xml`          | Localized documentation URLs                           |

## Validation

```bash
pnpm --filter @nest-boot/docs types:check
pnpm --filter @nest-boot/docs lint
pnpm build:docs
```
