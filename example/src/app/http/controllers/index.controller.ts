import { Can, Logger } from "@nest-boot/common";
import { Controller, Get } from "@nestjs/common";

import { PostService } from "../../core/services/post.service";

@Controller()
export class IndexController {
  private logger = new Logger(IndexController.name);

  constructor(private readonly postService: PostService) {}

  @Can("PUBLIC")
  @Get()
  index() {
    return this.postService.repository.findAll();
  }
}
