import { type RedisOptions } from "ioredis";

export interface EventEmitterModuleOptions extends RedisOptions {
  prefix?: string;
}
