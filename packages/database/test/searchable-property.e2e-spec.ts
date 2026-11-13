import { type Opt, t, wrap } from "@mikro-orm/core";
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
  ReflectMetadataProvider,
} from "@mikro-orm/decorators/legacy";
import { FullTextType, MikroORM } from "@mikro-orm/pglite";
import {
  onFullTextCreate,
  onFullTextUpdate,
  SearchableProperty,
  tokenizer,
} from "@nest-boot/database";

@Entity()
class SearchDocument {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: t.text, nullable: true })
  title: string | null = null;

  @Property({ type: t.text })
  description: Opt<string> = "Hello, world!";

  @Property({ type: t.integer })
  views: Opt<number> = 0;

  @Index({ type: "fulltext" })
  @Property({
    type: FullTextType,
    nullable: true,
    hidden: true,
    onCreate: onFullTextCreate("title"),
    onUpdate: onFullTextUpdate("title"),
  })
  searchableTitle!: string | null;

  @Index({ type: "fulltext" })
  @Property({
    type: FullTextType,
    nullable: true,
    hidden: true,
    onCreate: onFullTextCreate(["title", "description"]),
    onUpdate: onFullTextUpdate(["title", "description"]),
  })
  searchableText!: string | null;

  @SearchableProperty({ properties: ["title"], nullable: true })
  decoratedTitle!: string | null;
}

describe("full-text callbacks and SearchableProperty", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: "memory://",
      entities: [SearchDocument],
      metadataProvider: ReflectMetadataProvider,
      allowGlobalContext: true,
    });
    await orm.schema.create();
  });
  beforeEach(async () => {
    orm.em.clear();
    await orm.schema.clear();
  });
  afterAll(async () => {
    await orm?.close(true);
  });

  it("creates matching values through the native callbacks and decorator, including its index", async () => {
    const document = new SearchDocument();
    document.title = "你好世界";
    await orm.em.persist(document).flush();
    orm.em.clear();

    const loaded = await orm.em.findOneOrFail(SearchDocument, {
      decoratedTitle: { $fulltext: tokenizer("你好世界").join(" ") },
    });
    expect(loaded.searchableTitle).toBe(loaded.decoratedTitle);
    expect(
      await orm.em.count(SearchDocument, {
        searchableText: { $fulltext: tokenizer("你好世界 Hello").join(" ") },
      }),
    ).toBe(1);
    for (const field of [
      "searchableTitle",
      "searchableText",
      "decoratedTitle",
    ]) {
      expect(wrap(loaded).toObject()).not.toHaveProperty(field);
    }
    const indexes = await orm.em.execute<{ indexdef: string }[]>(
      "select indexdef from pg_indexes where tablename = 'search_document'",
    );
    expect(
      indexes.some(({ indexdef }) =>
        indexdef.includes("USING gin (decorated_title)"),
      ),
    ).toBe(true);
  });

  it("preserves current values across unrelated updates and reloads", async () => {
    const document = new SearchDocument();
    document.title = "Hello, world!";
    await orm.em.persist(document).flush();
    orm.em.clear();
    const loaded = await orm.em.findOneOrFail(SearchDocument, document.id);
    const original = [
      loaded.searchableTitle,
      loaded.searchableText,
      loaded.decoratedTitle,
    ];
    loaded.views++;
    await orm.em.flush();
    expect([
      loaded.searchableTitle,
      loaded.searchableText,
      loaded.decoratedTitle,
    ]).toEqual(original);
    await orm.em.flush();
    orm.em.clear();
    expect(
      await orm.em.count(SearchDocument, {
        decoratedTitle: { $fulltext: "world" },
      }),
    ).toBe(1);
  });

  it("rebuilds changed sources and removes stale tokens when text is cleared", async () => {
    const document = new SearchDocument();
    document.title = "Hello, world!";
    await orm.em.persist(document).flush();
    document.title = "你好世界";
    document.description = "Bonjour, monde!";
    await orm.em.flush();
    orm.em.clear();
    const loaded = await orm.em.findOneOrFail(SearchDocument, {
      decoratedTitle: { $fulltext: "世界" },
    });
    expect(
      await orm.em.count(SearchDocument, {
        searchableText: { $fulltext: tokenizer("你好世界 Bonjour").join(" ") },
      }),
    ).toBe(1);
    expect(
      await orm.em.count(SearchDocument, {
        decoratedTitle: { $fulltext: "world" },
      }),
    ).toBe(0);
    loaded.title = "";
    await orm.em.flush();
    orm.em.clear();
    const cleared = await orm.em.findOneOrFail(SearchDocument, document.id);
    expect(cleared.searchableTitle).toBeNull();
    expect(cleared.decoratedTitle).toBeNull();
    expect(
      await orm.em.count(SearchDocument, {
        searchableText: { $fulltext: "bonjour" },
      }),
    ).toBe(1);
    cleared.description = "";
    await orm.em.flush();
    orm.em.clear();
    expect(
      (await orm.em.findOneOrFail(SearchDocument, document.id)).searchableText,
    ).toBeNull();
  });

  it.each([false, true])(
    "rejects rebuilding with unloaded sibling sources (forceEntityConstructor: %s)",
    async (forceEntityConstructor) => {
      orm.config.set("forceEntityConstructor", forceEntityConstructor);
      try {
        const document = new SearchDocument();
        document.title = "Original title";
        document.description = "siblingtoken";
        await orm.em.persist(document).flush();
        orm.em.clear();
        const partial = await orm.em.findOneOrFail(
          SearchDocument,
          document.id,
          {
            fields: ["id", "title"],
          },
        );
        partial.title = "Replacement title";
        await expect(orm.em.flush()).rejects.toThrow(
          "load source properties description",
        );
        orm.em.clear();
        const stored = await orm.em.findOneOrFail(SearchDocument, document.id);
        expect(stored.title).toBe("Original title");
        expect(
          await orm.em.count(SearchDocument, {
            searchableText: { $fulltext: "siblingtoken" },
          }),
        ).toBe(1);
      } finally {
        orm.config.set("forceEntityConstructor", false);
      }
    },
  );

  it("preserves unloaded targets on unrelated partial updates and accepts explicitly assigned sources", async () => {
    const document = new SearchDocument();
    document.title = "Original title";
    document.description = "siblingtoken";
    await orm.em.persist(document).flush();
    orm.em.clear();
    const partialViews = await orm.em.findOneOrFail(
      SearchDocument,
      document.id,
      {
        fields: ["id", "views"],
      },
    );
    partialViews.views++;
    await orm.em.flush();
    orm.em.clear();
    expect(
      await orm.em.count(SearchDocument, {
        searchableText: { $fulltext: "siblingtoken" },
      }),
    ).toBe(1);
    const partialTitle = await orm.em.findOneOrFail(
      SearchDocument,
      document.id,
      {
        fields: ["id", "title"],
      },
    );
    orm.em.assign(partialTitle, {
      title: "Replacement title",
      description: "replacementtoken",
    });
    await orm.em.flush();
    orm.em.clear();
    expect(
      await orm.em.count(SearchDocument, {
        searchableText: { $fulltext: "replacementtoken" },
      }),
    ).toBe(1);
  });
});
