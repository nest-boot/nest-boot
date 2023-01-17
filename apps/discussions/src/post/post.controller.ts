import { Controller, Get } from "@nestjs/common";

import { PostService } from "./post.service";

@Controller("posts")
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get("/")
  async getHello(): Promise<string> {
    await this.postService.getConnection({ first: 10 });
    return "Hello World!";
  }
}
