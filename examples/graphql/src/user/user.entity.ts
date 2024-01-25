import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

import { Post } from "../post/post.entity";

@ObjectType()
@Entity()
export class User {
  constructor(data: Pick<User, "name"> & Partial<Pick<User, "id" | "posts">>) {
    this.name = data.name;

    data.id !== void 0 && (this.id = data.id);
    data.posts !== void 0 && (this.posts = data.posts);
  }

  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
  })
  id: string = randomUUID();

  @Field()
  @Property()
  name: string;

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => Post, (post) => post.user)
  posts = new Collection<Post>(this);
}
