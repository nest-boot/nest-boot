import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";

import { Post } from "../entities/post.entity";
import { Injectable } from "@nestjs/common";
import { createEntityService } from "@nest-boot/database";

@Injectable()
export class PostService extends mixinConnection(
  mixinSearchable(createEntityService(Post), {
    index: "Post",
    searchableAttributes: ["title", "html"],
  })
) {}
