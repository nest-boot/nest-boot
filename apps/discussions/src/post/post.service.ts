import { EntityManager } from "@mikro-orm/postgresql";
import { createEntityService } from "@nest-boot/database";
import { mixinConnection } from "@nest-boot/graphql";
import { Cron } from "@nest-boot/schedule";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { Post } from "./post.entity";

@Injectable()
export class PostService extends mixinConnection(
  mixinSearchable(createEntityService(Post, EntityManager), {
    filterableFields: [
      "id",
      "message",
      "createdAt",
      "user.name",
      "user.createdAt",
    ],
    searchableFields: ["id", "message", "createdAt", "user.name"],
  })
) {
  @Cron("* * * * * *")
  async test(): Promise<void> {
    const posts = await this.search("name: 1");
    console.log("test", posts.length);
  }
}
