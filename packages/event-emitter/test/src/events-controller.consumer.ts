import { Controller } from "@nestjs/common";

import { OnEvent } from "../../src";

@Controller()
export class EventsControllerConsumer {
  public eventPayload = {};

  @OnEvent("test.*")
  onTestEvent(payload: Record<string, any>) {
    this.eventPayload = payload;
  }
}
