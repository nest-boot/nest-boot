import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  ManyToOne,
} from "@nest-boot/database";
import { marked } from "marked";

import { User } from "./user.entity";

@Entity({ searchable: true })
export class Post extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: "text" })
  html: string;

  @Column({ type: "text" })
  markdown: string;

  @ManyToOne(() => User, (user) => user.posts, { cascade: true })
  author: User;

  @BeforeInsert()
  @BeforeUpdate()
  async beforeInsertOrUpdate(): Promise<void> {
    this.html = marked.parse(this.markdown);
  }
}
