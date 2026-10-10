import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { Inject, Injectable } from "@nestjs/common";

import { GraphQLRateLimitDriver } from "./drivers/index.js";
import { OPTIONS_TOKEN } from "./graphql-rate-limit.module-definition.js";
import type {
  CostThrottleStatus,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";

@Injectable()
export class GraphQLRateLimitStorage {
  constructor(
    private readonly driver: GraphQLRateLimitDriver,
    @Inject(OPTIONS_TOKEN)
    private readonly options: GraphQLRateLimitOptions,
  ) {}

  async addPoint(
    args: GraphQLRequestContext<BaseContext>,
    point: number,
  ): Promise<CostThrottleStatus> {
    const { blocked, currentlyAvailable } = await this.driver.update({
      key: `${this.options.keyPrefix}:${this.options.getId(args)}`,
      maximumAvailable: this.options.maximumAvailable,
      restoreRate: this.options.restoreRate,
      points: -point,
    });

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
    const { blocked, currentlyAvailable } = await this.driver.update({
      key: `${this.options.keyPrefix}:${this.options.getId(args)}`,
      maximumAvailable: this.options.maximumAvailable,
      restoreRate: this.options.restoreRate,
      points: point,
    });

    return {
      blocked,
      currentlyAvailable,
      maximumAvailable: this.options.maximumAvailable,
      restoreRate: this.options.restoreRate,
    };
  }
}
