import { Index, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/sql";

import { SearchableProperty } from "./searchable-property.decorator.js";

vi.mock("@mikro-orm/decorators/legacy", () => ({
  Property: vi.fn(() => vi.fn()),
  Index: vi.fn(() => vi.fn()),
}));

interface Book {
  title: string;
  search: string | null;
}

describe("SearchableProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides FullTextType, a full-text index and both lifecycle handlers", () => {
    const target = {} as Book;
    SearchableProperty<Book>({ properties: "title", nullable: true })(
      target,
      "search",
    );

    expect(Property).toHaveBeenCalledWith({
      type: FullTextType,
      hidden: true,
      nullable: true,
      onCreate: expect.any(Function),
      onUpdate: expect.any(Function),
    });
    expect(Index).toHaveBeenCalledWith({ type: "fulltext" });
    expect(vi.mocked(Property).mock.results[0].value).toHaveBeenCalledWith(
      target,
      "search",
    );
    expect(vi.mocked(Index).mock.results[0].value).toHaveBeenCalledWith(
      target,
      "search",
    );
  });

  it("allows the remaining property options to override defaults", () => {
    SearchableProperty<Book>({ properties: ["title"], hidden: false })(
      {} as Book,
      "search",
    );
    expect(vi.mocked(Property).mock.calls[0][0]).toMatchObject({
      hidden: false,
      type: FullTextType,
    });
  });

  it("rejects an empty source list", () => {
    expect(() => SearchableProperty<Book>({ properties: [] })).toThrow(
      "properties must have at least one property",
    );
  });

  it("ignores symbol target keys", () => {
    SearchableProperty<Book>({ properties: "title" })(
      {} as Book,
      Symbol("search"),
    );
    expect(Property).not.toHaveBeenCalled();
    expect(Index).not.toHaveBeenCalled();
  });
});
