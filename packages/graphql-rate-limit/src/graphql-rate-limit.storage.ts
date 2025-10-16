import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { Redis } from "@nest-boot/redis";
import { Inject, Injectable } from "@nestjs/common";

import {
  OPTIONS_TOKEN,
  REDIS_COMMAND,
} from "./graphql-rate-limit.module-definition";
import { CostThrottleStatus, GraphQLRateLimitOptions } from "./interfaces";

@Injectable()
export class GraphQLRateLimitStorage {
  constructor(
    private readonly redis: Redis,
    @Inject(OPTIONS_TOKEN)
    private readonly options: GraphQLRateLimitOptions,
  ) {
    this.redis.defineCommand(REDIS_COMMAND, {
      numberOfKeys: 5,
      lua: /* lua */ `
        -- 获取当前时间戳
        local currentTimestamp = redis.call("TIME")[1]
        
        -- 获取参数
        local bucketKeyPrefix = KEYS[1]
        local maximumAvailable = tonumber(KEYS[2])
        local restoreRate = tonumber(KEYS[3])
        local id = KEYS[4]
        local complexity = tonumber(KEYS[5])
        
        -- 定义存储桶的键
        local bucketKey = bucketKeyPrefix .. ":" .. id
        
        local keyExpireSeconds = math.ceil(maximumAvailable / restoreRate)
        
        -- 获取存储桶中当前的令牌数量，如果不存在，则设置为最大可用令牌数
        local currentlyAvailable = redis.call("HGET", bucketKey, "currentlyAvailable")
        if not currentlyAvailable then
          currentlyAvailable = maximumAvailable
        end
        
        -- 如果存储桶为空，设置上次更新时间戳为当前时间戳
        local updatedTimestamp = redis.call("HGET", bucketKey, "updatedTimestamp")
        if not updatedTimestamp then
          updatedTimestamp = currentTimestamp
        end
        
        -- 更新上次更新的时间戳
        redis.call("HSET", bucketKey, "updatedTimestamp", currentTimestamp)
        
        -- 更新存储桶的过期时间
        redis.call("EXPIRE", bucketKey, keyExpireSeconds)
        
        -- 计算自上次更新以来要恢复的令牌数量，并恢复存储桶中的令牌数量
        local intervalSeconds = currentTimestamp - updatedTimestamp;
        if intervalSeconds > 0 then
          currentlyAvailable = math.min((restoreRate * intervalSeconds) + currentlyAvailable, maximumAvailable);
          redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
        end
        
        -- 检查是否有足够的令牌供扣减，如果有，则扣减并返回剩余令牌数
        local newCurrentlyAvailable = currentlyAvailable - complexity
        if newCurrentlyAvailable >= 0 then
          currentlyAvailable = newCurrentlyAvailable
          redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
          return { false, currentlyAvailable };
        end
        
        return { true, currentlyAvailable }
      `,
    });
  }

  async addPoint(
    args: GraphQLRequestContext<BaseContext>,
    point: number,
  ): Promise<CostThrottleStatus> {
    const [blocked, currentlyAvailable] = (await (this.redis as any)[
      REDIS_COMMAND
    ](
      this.options.keyPrefix,
      this.options.maximumAvailable,
      this.options.restoreRate,
      this.options.getId(args),
      -point,
    )) as [boolean, number];

    return {
      blocked,
      currentlyAvailable,
      maximumAvailable: this.options.maximumAvailable,
      restoreRate: this.options.restoreRate,
    };
  }

  async subPoint(
    args: GraphQLRequestContext<BaseContext>,
    point: number,
  ): Promise<CostThrottleStatus> {
    const [blocked, currentlyAvailable] = (await (this.redis as any)[
      REDIS_COMMAND
    ](
      this.options.keyPrefix,
      this.options.maximumAvailable,
      this.options.restoreRate,
      this.options.getId(args),
      point,
    )) as [boolean, number];

    return {
      blocked,
      currentlyAvailable,
      maximumAvailable: this.options.maximumAvailable,
      restoreRate: this.options.restoreRate,
    };
  }
}
