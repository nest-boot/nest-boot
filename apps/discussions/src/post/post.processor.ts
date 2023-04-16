import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { Processor } from "@nest-boot/queue";
import { Injectable } from "@nestjs/common";
import { PostService } from "./post.service";

@Injectable()
export class PostProcessor {
  constructor(
    private readonly orm: MikroORM,
    private readonly postService: PostService
  ) {}

  @Processor("test")
  @UseRequestContext()
  async handle() {
    await this.postService.repository.findAll();
  }
}
