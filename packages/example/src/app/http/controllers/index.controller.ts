import { Can } from "@nest-boot/common";
import { Controller, Get } from "@nestjs/common";

@Controller()
export class IndexController {
  constructor() {
    return this;
  }

  @Can("PUBLIC")
  @Get()
  index(): string {
    return "index";
  }
}
