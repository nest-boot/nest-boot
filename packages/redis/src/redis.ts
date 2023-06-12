import { Injectable } from "@nestjs/common";
import IORedis, { type Redis as RedisInterface } from "ioredis";

@Injectable()
export class Redis extends IORedis implements RedisInterface {}
