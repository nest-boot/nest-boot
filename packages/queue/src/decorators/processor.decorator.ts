import { Injectable, InjectableOptions, Scope, Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { JobProcessor } from "../interfaces";

export const ProcessorDecorator = Reflector.createDecorator<{
  name: string;
  queue: string;
}>();

export const Processor = (
  name: string,
  options?: InjectableOptions & { queue?: string },
) => {
  return (target: Type<JobProcessor>) => {
    Injectable({ scope: options?.scope ?? Scope.DEFAULT })(target);
    ProcessorDecorator({
      name,
      queue: options?.queue ?? "default",
    })(target);
  };
};
