import { Logger as PinoLogger } from "@nest-boot/logger";
import { Controller, Get, Logger as NestLogger } from "@nestjs/common";

import { PostService } from "./post.service";

@Controller("posts")
export class PostController {
  private readonly logger1 = new NestLogger(PostController.name);

  constructor(
    private readonly logger2: PinoLogger,
    private readonly postService: PostService
  ) {
    this.logger2.setContext(PostController.name);
  }

  @Get("/")
  async getHello() {
    this.logger1.log("Logger1", { loggerName: "logger1", date: new Date() });
    this.logger2.log("Logger2", { loggerName: "logger2", date: new Date() });

    const posts = await this.postService.repository.findAll();

    console.log("posts", posts);

    return posts;
  }
}
