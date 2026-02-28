import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

export const { GET } = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  // Orama doesn't support Chinese, fall back to English tokenizer
  localeMap: {
    "zh-Hans": "english",
  },
});
