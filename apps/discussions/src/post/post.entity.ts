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
  @Field(() => ID)
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
    onCreate: () => randomUUID(),
  })
  id!: string;

  @Field({ complexity: 1 })
  @Property()
  message!: string;

  @Field()
  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Field()
  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToOne()
  user!: Ref<User>;
}
