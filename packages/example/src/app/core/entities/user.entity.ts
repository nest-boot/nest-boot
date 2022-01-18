import { mixinPermissions } from "@nest-boot/auth";
import {
  BaseEntity,
  Column,
  Entity,
  HashColumn,
  OneToMany,
} from "@nest-boot/database";

import { Post } from "./post.entity";

@Entity({ searchable: true })
export class User extends mixinPermissions(BaseEntity) {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @HashColumn()
  password: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
