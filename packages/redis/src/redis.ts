import IORedis, { Redis as RedisInterface } from "ioredis";

export class Redis extends IORedis implements RedisInterface {}
