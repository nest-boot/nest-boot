import {
  Property,
  Entity,
  ManyToOne,
  IdentifiedReference,
  PrimaryKey,
  t,
  EntityRepositoryType,
} from "@nest-boot/database";
import { SnowflakeIdGenerator } from "snowflake-id-generator";
import { PostRepository } from "../repositories/post.repository";

import { User } from "./user.entity";

@Entity({ customRepository: () => PostRepository })
export class Post {
  [EntityRepositoryType]?: PostRepository;

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
