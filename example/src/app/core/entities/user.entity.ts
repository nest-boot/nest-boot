import {
  Entity,
  OneToMany,
  Property,
  Collection,
  PrimaryKey,
  t,
} from "@nest-boot/database";
import { SnowflakeIdGenerator } from "snowflake-id-generator";

import { Post } from "./post.entity";

@Entity()
export class User {
  @PrimaryKey({ type: t.bigint })
  id = SnowflakeIdGenerator.next().toString();

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @Property()
  password: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @OneToMany(() => Post, (post) => post.author)
  posts = new Collection<Post>(this);
}
