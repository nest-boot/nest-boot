import type { FullTextProperties } from "../types/full-text-properties.type.js";
import { onFullTextCreate } from "./on-full-text-create.util.js";

interface Book {
  title?: unknown;
  description?: unknown;
}

describe("onFullTextCreate", () => {
  it.each([{ properties: "title" }, { properties: ["title"] }] as const)(
    "supports one source: $properties",
    ({ properties }) => {
      expect(
        onFullTextCreate<Book>(properties)({
          title: "你好世界",
          description: "ignored",
        }),
      ).toBe("你好 世界");
    },
  );

  it("combines multiple sources into one string", () => {
    expect(
      onFullTextCreate<Book>(["title", "description"] as const)({
        title: "你好世界",
        description: "Hello World",
      }),
    ).toBe("你好 世界 hello world");
  });

  it.each([null, undefined, 123, "", "!!! 🎉"])(
    "clears sources without words: %j",
    (title) => {
      expect(onFullTextCreate<Book>("title")({ title })).toBeNull();
    },
  );

  it("skips empty and non-string values when combining sources", () => {
    expect(
      onFullTextCreate<Book>(["title", "description"])({
        title: null,
        description: "Hello!",
      }),
    ).toBe("hello");
  });

  it("rejects an empty source list", () => {
    expect(() => onFullTextCreate<Book>([])).toThrow(
      "properties must have at least one property",
    );
  });

  it.each(["", {}, [null]])(
    "rejects invalid source names: %j",
    (properties) => {
      expect(() =>
        onFullTextCreate<Book>(
          properties as unknown as FullTextProperties<Book>,
        ),
      ).toThrow(
        "properties must be a property name or an array of property names",
      );
    },
  );
});
