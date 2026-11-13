const UNICODE_WORD = /[\p{L}\p{M}\p{N}]+/gu;
let multilingualSegmenter: Intl.Segmenter | undefined;

/**
 * Splits indexed text or search input into lowercase word tokens using the runtime locale.
 * Falls back to Unicode letter, combining mark and number runs without Intl.Segmenter.
 * @param input - Text to segment.
 * @returns Lowercase word tokens. Join with spaces for a MikroORM $fulltext query.
 */
export function tokenizer(input: string): string[] {
  if (
    multilingualSegmenter === undefined &&
    typeof Intl !== "undefined" &&
    typeof Intl.Segmenter === "function"
  ) {
    multilingualSegmenter = new Intl.Segmenter(undefined, {
      granularity: "word",
    });
  }
  if (multilingualSegmenter) {
    const parts: string[] = [];
    for (const { segment, isWordLike } of multilingualSegmenter.segment(
      input,
    )) {
      if (isWordLike) {
        parts.push(segment.toLowerCase());
      }
    }
    return parts;
  }
  return input.toLowerCase().match(UNICODE_WORD) ?? [];
}
