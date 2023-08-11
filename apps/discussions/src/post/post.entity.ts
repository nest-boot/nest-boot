import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
  t,
} from "@mikro-orm/core";
import { Searchable } from "@nest-boot/search";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

import { type User } from "../user/user.entity";

@Searchable({
  filterableFields: [
    "id",
    "message",
    "createdAt",
    "user.name",
    "user.createdAt",
  ],
  searchableFields: ["id", "message", "createdAt", "user.name"],
})
@ObjectType()
@Entity()
export class Post {
  constructor(data: Pick<Post, "message" | "user">) {
    this.message = data.message;
    this.user = data.user;
  }

  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
  })
  id: string = randomUUID();

  @Field({ complexity: 1 })
  @Property()
  message: string;

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  deletedAt: Date | null = null;

  @ManyToOne({ nullable: true })
  user: Ref<User>;
}
