import { createEntityService } from "@nest-boot/database";
import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { Post } from "./post.entity";

@Injectable()
export class PostService extends mixinConnection(
  mixinSearchable(createEntityService(Post), {
    index: "Post",
    filterableAttributes: [
      "id",
      "message",
      "createdAt",
      "user.name",
      "user.createdAt",
    ],
    searchableAttributes: ["id", "message", "createdAt", "user.name"],
    sortableAttributes: ["createdAt"],
  })
) {}
