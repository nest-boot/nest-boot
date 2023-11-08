import { Reflector } from "@nestjs/core";

export const LegacyProcessorDecorator = Reflector.createDecorator<{
  name: string;
  queue: string;
}>();

export const LegacyProcessor = (name: string, queue?: string) => {
  return LegacyProcessorDecorator({
    name,
    queue: queue ?? "default",
  });
};
