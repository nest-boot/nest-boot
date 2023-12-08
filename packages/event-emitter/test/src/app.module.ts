import { Module } from "@nestjs/common";

import { EventEmitterModule } from "../../src";
import { CustomEventDecoratorConsumer } from "./custom-decorator-test.consumer";
import { EventsProducer } from "./events.producer";
import { EventsControllerConsumer } from "./events-controller.consumer";
import { EventsProviderConsumer } from "./events-provider.consumer";
import { EventsProviderRequestScopedConsumer } from "./events-provider.request-scoped.consumer";
import { EventsProviderAliasedConsumer } from "./events-provider-aliased.consumer";
import { EventsProviderPrependConsumer } from "./events-provider-prepend.consumer";
import { TestProvider } from "./test-provider";

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
  ],
  controllers: [EventsControllerConsumer],
  providers: [
    EventsProviderConsumer,
    EventsProviderPrependConsumer,
    EventsProducer,
    TestProvider,
    EventsProviderRequestScopedConsumer,
    EventsProviderAliasedConsumer,
    {
      provide: "AnAliasedConsumer",
      useExisting: EventsProviderAliasedConsumer,
    },
    CustomEventDecoratorConsumer,
  ],
})
export class AppModule {}
