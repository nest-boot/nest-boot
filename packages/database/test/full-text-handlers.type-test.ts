import type { PropertyOptions } from "@mikro-orm/core";
import { Property } from "@mikro-orm/decorators/legacy";

import {
  onFullTextCreate,
  onFullTextUpdate,
  SearchableProperty,
  type SearchablePropertyOptions,
  whenChanged,
} from "../src/index.js";

interface Book {
  title: string;
  description: string;
  search: string | null;
}

export class InferredBook {
  title!: string;

  @Property({
    onCreate: onFullTextCreate("title"),
    onUpdate: onFullTextUpdate("title"),
  })
  search!: string | null;

  @Property({
    // @ts-expect-error The surrounding class supplies the valid source names.
    onCreate: onFullTextCreate("missing"),
  })
  invalid!: string | null;
}

export class InferredSearchableBook {
  title!: string;
  description!: string;

  @SearchableProperty({ properties: "title", nullable: true })
  single!: string | null;

  @SearchableProperty({ properties: ["title"], nullable: true })
  singleton!: string | null;

  @SearchableProperty({
    properties: ["title", "description"] as const,
    nullable: true,
  })
  combined!: string | null;

  @SearchableProperty({
    // @ts-expect-error The class determines which source properties exist.
    properties: "missing",
    nullable: true,
  })
  invalidName!: string | null;

  @SearchableProperty({
    // @ts-expect-error Array members are also checked against the class.
    properties: ["title", "missing"],
    nullable: true,
  })
  invalidList!: string | null;
}

export const single: PropertyOptions<Book> = {
  onCreate: onFullTextCreate("title"),
  onUpdate: onFullTextUpdate("title"),
};
export const singleton: PropertyOptions<Book> = {
  onCreate: onFullTextCreate(["title"]),
  onUpdate: onFullTextUpdate(["title"]),
};
export const multiple: PropertyOptions<Book> = {
  onCreate: onFullTextCreate(["title", "description"]),
  onUpdate: onFullTextUpdate(["title", "description"]),
};
export const guarded: PropertyOptions<Book> = {
  onUpdate: whenChanged((book) => book.title, ["title"]),
};
onFullTextCreate<Book>(["title", "description"] as const);
SearchableProperty<Book>({
  properties: "title",
  nullable: true,
  hidden: false,
});

onFullTextCreate<Book>(
  // @ts-expect-error Only entity property names are accepted.
  "missing",
);
onFullTextUpdate<Book>(
  // @ts-expect-error Source configuration must be a name or name array.
  { title: "description" },
);

export const forbiddenType: SearchablePropertyOptions<Book> = {
  properties: "title",
  // @ts-expect-error The decorator fixes its storage type.
  type: "text",
};
export const forbiddenIndex: SearchablePropertyOptions<Book> = {
  properties: "title",
  // @ts-expect-error The decorator creates the full-text index.
  index: true,
};
export const forbiddenCreate: SearchablePropertyOptions<Book> = {
  properties: "title",
  // @ts-expect-error The decorator installs its create handler.
  onCreate: () => "override",
};
export const forbiddenUpdate: SearchablePropertyOptions<Book> = {
  properties: "title",
  // @ts-expect-error The decorator installs its update handler.
  onUpdate: () => "override",
};
