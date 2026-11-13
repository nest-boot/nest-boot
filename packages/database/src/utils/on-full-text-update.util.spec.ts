import type { EntityManager, EntityProperty } from "@mikro-orm/core";

import { onFullTextUpdate } from "./on-full-text-update.util.js";

interface Book {
  title: string | null;
  description: string;
  search: string | null;
}

describe("onFullTextUpdate", () => {
  const metadata = { name: "search" } as EntityProperty<Book>;

  it.each([{ properties: "title" }, { properties: ["title"] }] as const)(
    "rebuilds a changed source: $properties",
    ({ properties }) => {
      const update = onFullTextUpdate<Book>(properties);
      expect(
        update.call(
          metadata,
          { title: "你好世界", description: "ignored", search: "old" },
          entityManagerWithChanges({ title: "你好世界" }),
        ),
      ).toBe("你好 世界");
    },
  );

  it("rebuilds combined text when any source changes", () => {
    const update = onFullTextUpdate<Book>(["title", "description"]);
    expect(
      update.call(
        metadata,
        { title: "你好世界", description: "Hello World", search: "old" },
        entityManagerWithChanges({ description: "Hello World" }),
      ),
    ).toBe("你好 世界 hello world");
  });

  it("preserves the target across unrelated updates", () => {
    const update = onFullTextUpdate<Book>("title");
    expect(
      update.call(
        metadata,
        { title: "Hello", description: "changed", search: "stored" },
        entityManagerWithChanges({ description: "changed" }),
      ),
    ).toBe("stored");
  });

  it("clears stale tokens when all sources are empty", () => {
    const update = onFullTextUpdate<Book>(["title", "description"]);
    expect(
      update.call(
        metadata,
        { title: null, description: "!!!", search: "old" },
        entityManagerWithChanges({ title: null }),
      ),
    ).toBeNull();
  });
});

/**
 * Supplies tracked source changes for update tests.
 * @param changes - Properties reported as changed by the ORM comparator.
 * @returns Entity manager test double.
 */
function entityManagerWithChanges(changes: Partial<Book>): EntityManager {
  return {
    getUnitOfWork: () => ({
      getOriginalEntityData: () => ({ title: "old", description: "old" }),
    }),
    getComparator: () => ({
      prepareEntity: (entity: Book) => entity,
      diffEntities: () => changes,
    }),
  } as unknown as EntityManager;
}
