import { Injectable, InjectableOptions, Scope, Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { QueueConsumer } from "../interfaces";

export const ConsumerDecorator = Reflector.createDecorator<{ queue: string }>();

export const Consumer = (queue?: string, options?: InjectableOptions) => {
  return (target: Type<QueueConsumer>) => {
    Injectable({ scope: options?.scope ?? Scope.DEFAULT })(target);
    ConsumerDecorator({ queue: queue ?? "default" })(target);
  };
};
