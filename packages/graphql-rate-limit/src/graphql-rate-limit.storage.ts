import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

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
        -- Get current timestamp
        local currentTimestamp = redis.call("TIME")[1]
        
        -- Get arguments
        local bucketKeyPrefix = KEYS[1]
        local maximumAvailable = tonumber(KEYS[2])
        local restoreRate = tonumber(KEYS[3])
        local id = KEYS[4]
        local complexity = tonumber(KEYS[5])
        
        -- Define the bucket key
        local bucketKey = bucketKeyPrefix .. ":" .. id
        
        local keyExpireSeconds = math.ceil(maximumAvailable / restoreRate)
        
        -- Get the current number of tokens in the bucket; if it doesn't exist, set to max available
        local currentlyAvailable = redis.call("HGET", bucketKey, "currentlyAvailable")
        if not currentlyAvailable then
          currentlyAvailable = maximumAvailable
        end
        
        -- If the bucket is empty, set the last updated timestamp to the current timestamp
        local updatedTimestamp = redis.call("HGET", bucketKey, "updatedTimestamp")
        if not updatedTimestamp then
          updatedTimestamp = currentTimestamp
        end
        
        -- Update the last updated timestamp
        redis.call("HSET", bucketKey, "updatedTimestamp", currentTimestamp)
        
        -- Update the bucket's expiration time
        redis.call("EXPIRE", bucketKey, keyExpireSeconds)
        
        -- Calculate the number of tokens to restore since the last update, and restore tokens in the bucket
        local intervalSeconds = currentTimestamp - updatedTimestamp;
        if intervalSeconds > 0 then
          currentlyAvailable = math.min((restoreRate * intervalSeconds) + currentlyAvailable, maximumAvailable);
          redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
        end
        
        -- Check if there are enough tokens to deduct; if so, deduct and return the remaining tokens
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
