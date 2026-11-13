import type { EntityManager, EntityProperty } from "@mikro-orm/core";

import { whenChanged } from "./when-changed.util.js";

interface Book {
  title: string;
  description: string;
  search: string | null;
}

describe("whenChanged", () => {
  const book: Book = {
    title: "new title",
    description: "text",
    search: "stored",
  };
  const metadata = { name: "search" } as EntityProperty<Book>;

  it("forwards the entity, manager and property context only when a dependency changes", () => {
    const update = vi.fn((entity: Book) => entity.title);
    const guarded = whenChanged(update, ["title", "description"]);
    const em = entityManagerWithChanges({ description: "text" });
    expect(guarded.call(metadata, book, em)).toBe("new title");
    expect(update).toHaveBeenCalledWith(book, em);
    expect(update.mock.contexts[0]).toBe(metadata);
  });

  it("preserves the current target on unrelated updates", () => {
    const update = vi.fn((entity: Book) => entity.title);
    expect(
      whenChanged(update, ["title"]).call(
        metadata,
        book,
        entityManagerWithChanges({ description: "changed" }),
      ),
    ).toBe("stored");
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves null and values without an original snapshot", () => {
    const guarded = whenChanged((entity: Book) => entity.title, ["title"]);
    expect(
      guarded.call(
        metadata,
        { ...book, search: null },
        entityManagerWithChanges({}),
      ),
    ).toBeNull();
    expect(
      guarded.call(metadata, book, entityManagerWithChanges({}, false)),
    ).toBe("stored");
  });

  it("requires dependencies and the property callback context", () => {
    expect(() => whenChanged((entity: Book) => entity.title, [])).toThrow(
      "properties must have at least one property",
    );
    const guarded = whenChanged((entity: Book) => entity.title, ["title"]);
    expect(() => guarded(book, entityManagerWithChanges({}))).toThrow(
      "whenChanged must be used as a MikroORM onUpdate callback",
    );
  });

  it("rejects a changed source when another dependency has not been loaded", () => {
    const update = vi.fn((entity: Book) => entity.title);
    const guarded = whenChanged(update, ["title", "description"]);
    expect(() =>
      guarded.call(
        metadata,
        book,
        entityManagerWithChanges({ title: "new title" }, true, {
          title: "old",
        }),
      ),
    ).toThrow("load source properties description");
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * Supplies the ORM's snapshot comparison result.
 * @param changes - Changed properties.
 * @param hasOriginal - Whether an original snapshot is available.
 * @param original - Originally loaded property values.
 * @returns Entity manager test double.
 */
function entityManagerWithChanges(
  changes: Partial<Book>,
  hasOriginal = true,
  original: Partial<Book> = { title: "old", description: "old" },
): EntityManager {
  return {
    getUnitOfWork: () => ({
      getOriginalEntityData: () => (hasOriginal ? original : undefined),
    }),
    getComparator: () => ({
      prepareEntity: (entity: Book) => entity,
      diffEntities: () => changes,
    }),
  } as unknown as EntityManager;
}
