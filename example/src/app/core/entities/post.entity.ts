import {
  Property,
  Entity,
  ManyToOne,
  IdentifiedReference,
  PrimaryKey,
  t,
} from "@mikro-orm/core";
import { SnowflakeIdGenerator } from "snowflake-id-generator";

import { User } from "./user.entity";

@Entity()
export class Post {
  @PrimaryKey({ type: t.bigint })
  id = SnowflakeIdGenerator.next().toString();

  @Property()
  title: string;

  @Property({ type: "text" })
  html: string = "html";

  @Property({ type: "text" })
  markdown: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @ManyToOne({ nullable: true })
  author: IdentifiedReference<User>;
}
