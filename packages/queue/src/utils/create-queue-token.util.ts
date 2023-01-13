import { InjectionToken } from "@nestjs/common";

export function createQueueToken(name: string): InjectionToken {
  return Symbol(`QUEUE_SERVICE[${name}]`);
}
