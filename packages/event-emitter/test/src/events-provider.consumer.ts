import { Injectable } from "@nestjs/common";

import { OnEvent } from "../../src";

@Injectable()
export class EventsProviderConsumer {
  public eventPayload = {};
  public stackedEventCalls = 0;
  public errorHandlingCalls = 0;

  @OnEvent("test.*")
  onTestEvent(payload: Record<string, any>) {
    this.eventPayload = payload;
  }

  @OnEvent("stacked1.*")
  @OnEvent("stacked2.*")
  onStackedEvent() {
    this.stackedEventCalls++;
  }

  @OnEvent("error-handling.provider")
  onErrorHandlingEvent() {
    this.errorHandlingCalls++;
    throw new Error("This is a test error");
  }

  @OnEvent("error-handling-suppressed.provider", { suppressErrors: true })
  onErrorHandlingSuppressedEvent() {
    this.errorHandlingCalls++;
    throw new Error("This is a test error");
  }

  @OnEvent("error-throwing.provider", { suppressErrors: false })
  onErrorThrowingEvent() {
    throw new Error("This is a test error");
  }
}
