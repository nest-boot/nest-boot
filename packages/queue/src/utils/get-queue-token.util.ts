import { InjectionToken } from "@nestjs/common";

const QUEUE_TOKEN = new Map<string, InjectionToken>();

export function getQueueToken(name: string): InjectionToken {
  let token = QUEUE_TOKEN.get(name);

  if (typeof token === "undefined") {
    token = Symbol(name);
    QUEUE_TOKEN.set(name, token);
  }

  return token;
}
