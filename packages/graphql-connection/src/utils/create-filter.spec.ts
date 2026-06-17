import type { ConnectionFieldOptions, FieldOptions } from "../interfaces";
import { createFilter } from "./create-filter";

interface Book {
  title: string;
  searchableTitle: string;
}

describe("createFilter", () => {
  it("maps $fulltext to a configured fulltext field path", () => {
    const titleField = {
      field: "title",
      type: "string",
      fulltext: "searchableTitle",
    } satisfies FieldOptions<Book, "string", "searchableTitle">;
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", titleField],
    ]);

    const { filterQuerySchema } = createFilter("Book", fieldOptionsMap);

    expect(
      filterQuerySchema.parse({ title: { $fulltext: "search term" } }),
    ).toEqual({
      searchableTitle: { $fulltext: "search term" },
    });
  });

  it("keeps non-fulltext operators on the original field", () => {
    const titleField = {
      field: "title",
      type: "string",
      fulltext: "searchableTitle",
    } satisfies FieldOptions<Book, "string", "searchableTitle">;
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", titleField],
    ]);

    const { filterQuerySchema } = createFilter("Book", fieldOptionsMap);

    expect(
      filterQuerySchema.parse({
        title: { $eq: "exact title", $fulltext: "search term" },
      }),
    ).toEqual({
      title: { $eq: "exact title" },
      searchableTitle: { $fulltext: "search term" },
    });
  });
});
