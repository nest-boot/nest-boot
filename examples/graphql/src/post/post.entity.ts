import { Entity, Index, PrimaryKey, Property, t } from "@mikro-orm/core";
import { FullTextType } from "@mikro-orm/postgresql";
import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { Searchable } from "@nest-boot/search";
import { randomUUID } from "crypto";

@ObjectType()
@Searchable({
  aliasFields: {
    content: "searchableContent",
  },
  filterableFields: ["title", "searchableContent", "createdAt", "updatedAt"],
  searchableFields: ["title", "searchableContent"],
})
@Entity()
export class Post {
  constructor(
    data: Pick<Post, "title" | "content"> &
      Partial<Pick<Post, "id" | "createdAt" | "updatedAt">>,
  ) {
    this.title = data.title;
    this.content = data.content;
    this.searchableContent = data.content;

    data.id !== void 0 && (this.id = data.id);
    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
  }

  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
  })
  id: string = randomUUID();

  @Field({ complexity: 5 })
  @Property()
  title: string;

  @Field()
  @Property({ type: "text" })
  content: string;

  @Index({ type: "fulltext" })
  @Property({
    type: FullTextType,
    onUpdate: (post: Post) => post.content,
    hidden: true,
  })
  searchableContent: string;

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
