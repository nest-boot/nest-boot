import { SearchService } from "@nest-boot/search";
import { Controller, Get, Query } from "@nestjs/common";

import { Post } from "./post.entity";

@Controller("posts")
export class PostController {
  constructor(private readonly searchService: SearchService) {}

  @Get("/")
  async search(@Query("query") query: string): Promise<Post[]> {
    const [posts] = await this.searchService.search(Post, query);
    return posts;
  }
}
