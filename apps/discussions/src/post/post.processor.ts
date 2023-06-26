import { EntityManager } from "@mikro-orm/postgresql";
import { Processor } from "@nest-boot/queue";
import { Injectable } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostService } from "./post.service";

@Injectable()
export class PostProcessor {
  constructor(private readonly postService: PostService) {}

  @Processor("test")
  async handle(): Promise<void> {
    await this.postService.entityManager.getRepository(Post).findAll();
  }
}
