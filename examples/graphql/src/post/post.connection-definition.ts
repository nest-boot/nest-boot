import { ConnectionBuilder } from "@nest-boot/graphql-connection";

import { Post } from "./post.entity";

export const { Connection, ConnectionArgs } = new ConnectionBuilder(Post)
  .addField({ field: "id", filterable: true })
  .addField({ field: "title", filterable: true })
  .addField({
    field: "content",
    replacement: "searchableContent",
    filterable: true,
  })
  .addField({ field: "user_id", replacement: "user.id", filterable: true })
  .addField({ field: "created_at", replacement: "createdAt", sortable: true })
  .addField({
    field: "published",
    type: "boolean",
    filterable: true,
    replacement: ({ value }) => {
      return value
        ? { publishedAt: { $eq: null } }
        : { publishedAt: { $ne: null } };
    },
  })
  .build();
