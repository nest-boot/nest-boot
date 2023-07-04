import { EntityManager } from "@mikro-orm/postgresql";
import { Processor } from "@nest-boot/queue";
import { Injectable } from "@nestjs/common";

import { Post } from "./post.entity";

@Injectable()
export class PostProcessor {
  constructor(private readonly em: EntityManager) {}

  @Processor("test")
  async handle(): Promise<void> {
    await this.em.getRepository(Post).findAll();
  }
}
