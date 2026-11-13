import { raw } from "@mikro-orm/core";

import { normalizeFullTextFilter } from "./normalize-full-text-filter.js";

describe("normalizeFullTextFilter", () => {
  it("segments multilingual operands without mutating the original filter", () => {
    const filter = {
      searchableTitle: { $fulltext: "你好世界 HELLO, World!" },
    };
    expect(normalizeFullTextFilter(filter)).toEqual({
      searchableTitle: { $fulltext: "你好 世界 hello world" },
    });
    expect(filter.searchableTitle.$fulltext).toBe("你好世界 HELLO, World!");
  });

  it.each(["$some", "$none", "$every"])(
    "normalizes nested logical groups and %s relation conditions",
    (operator) => {
      expect(
        normalizeFullTextFilter({
          $and: [
            {
              $or: [
                { author: { search: { $fulltext: "你好世界" } } },
                { books: { [operator]: { search: { $fulltext: "HELLO!" } } } },
              ],
            },
            { $not: { search: { $fulltext: "GOODBYE" } } },
          ],
        }),
      ).toEqual({
        $and: [
          {
            $or: [
              { author: { search: { $fulltext: "你好 世界" } } },
              { books: { [operator]: { search: { $fulltext: "hello" } } } },
            ],
          },
          { $not: { search: { $fulltext: "goodbye" } } },
        ],
      });
    },
  );

  it("preserves comparison data, dates and regular expressions", () => {
    const literal = { $fulltext: "KEEP Original, Text!" };
    const date = new Date("2026-01-01");
    const pattern = /HELLO/i;
    const filter = {
      title: { $eq: "KEEP Original, Text!", $re: pattern },
      createdAt: { $gte: date },
      data: { $eq: literal, $in: [literal], $contains: literal },
    };
    expect(normalizeFullTextFilter(filter)).toEqual(filter);
    expect(normalizeFullTextFilter(date)).toBe(date);
    expect(normalizeFullTextFilter(pattern)).toBe(pattern);
    expect(normalizeFullTextFilter(null)).toBeNull();
    expect(normalizeFullTextFilter("Original!")).toBe("Original!");
  });

  it("preserves symbol-keyed raw SQL scope conditions alongside full-text operands", () => {
    const scope = raw((alias) => `${alias}."data"->>'userId'`);
    const filter = {
      $and: [
        { [scope]: "user-1" },
        { search: { $fulltext: "你好世界 HELLO!" } },
      ],
    };
    expect(normalizeFullTextFilter(filter)).toEqual({
      $and: [
        { [scope]: "user-1" },
        { search: { $fulltext: "你好 世界 hello" } },
      ],
    });
    expect(filter.$and[1]).toEqual({
      search: { $fulltext: "你好世界 HELLO!" },
    });
  });

  it("preserves absent operands and retains tokenless searches as empty full-text queries", () => {
    expect(
      normalizeFullTextFilter({ search: { $fulltext: undefined } }),
    ).toEqual({ search: { $fulltext: undefined } });
    expect(
      normalizeFullTextFilter({ search: { $fulltext: "!!!   " } }),
    ).toEqual({
      search: { $fulltext: "" },
    });
  });

  it("accepts null-prototype filter dictionaries", () => {
    expect(
      normalizeFullTextFilter({
        __proto__: null,
        search: { $fulltext: "HELLO" },
      }),
    ).toEqual({ search: { $fulltext: "hello" } });
  });
});
