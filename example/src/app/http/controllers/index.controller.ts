import { Can, Logger } from "@nest-boot/common";
import { Controller, Get } from "@nestjs/common";

import { TestQueue } from "../../core/queues/test.queue";

@Controller()
export class IndexController {
  private logger = new Logger(IndexController.name);

  constructor(private readonly testQueue: TestQueue) {
    this.logger.log("Hello world!");
  }

  @Can("PUBLIC")
  @Get()
  index(): string {
    this.logger.log("Hello world!", { abc: 123 });
    this.testQueue.add("test", {});

    throw new Error("TEST ERROR");
  }
}
