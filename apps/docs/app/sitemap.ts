import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedHomePages: MetadataRoute.Sitemap = ["en", "zh-Hans"].map(
    (language) => ({
      url: new URL(`/${language}`, siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    }),
  );

  const documentationPages: MetadataRoute.Sitemap = source
    .getPages()
    .map((page) => ({
      url: new URL(page.url, siteUrl).toString(),
      changeFrequency: "weekly",
      priority: page.slugs.length === 0 ? 0.9 : 0.7,
    }));

  return [...localizedHomePages, ...documentationPages];
}
