import { Injectable, InjectableOptions, Scope, Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { QueueConsumer } from "../interfaces/queue-consumer.interface";

export interface ConsumerOptions extends InjectableOptions {
  name: string;
}

export const ConsumerDecorator = Reflector.createDecorator<ConsumerOptions>();

export const Consumer = (
  name: string,
  options?: Omit<ConsumerOptions, "name">,
) => {
  return <T extends Type<QueueConsumer>>(target: T) => {
    Injectable({ scope: options?.scope ?? Scope.DEFAULT })(target);

    ConsumerDecorator({
      ...options,
      name,
    })(target);
  };
};
