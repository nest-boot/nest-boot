import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  ManyToOne,
} from "@nest-boot/database";
import { mixinTenantId } from "@nest-boot/tenant";
import remark from "remark";
import remarkHtml from "remark-html";

import { User } from "./user.entity";

@Entity({ searchable: true })
export class Post extends mixinTenantId(BaseEntity) {
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
    this.html = (await remark().use(remarkHtml).process(this.markdown))
      .contents as string;
  }
}
