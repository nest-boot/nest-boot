import { Injectable } from "@nestjs/common";
import { type HealthIndicatorFunction } from "@nestjs/terminus";

@Injectable()
export class HealthCheckRegistry {
  #healthIndicators: HealthIndicatorFunction[] = [];

  get healthIndicators(): HealthIndicatorFunction[] {
    return this.#healthIndicators;
  }

  register(...healthIndicators: HealthIndicatorFunction[]): void {
    this.#healthIndicators.push(...healthIndicators);
  }
}
