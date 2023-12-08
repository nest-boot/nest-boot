import { ConnectionBuilder } from "@nest-boot/graphql";

import { Post } from "./post.entity";

export const { Connection, ConnectionArgs } = new ConnectionBuilder(Post, {
  orderFields: ["createdAt"],
}).build();
