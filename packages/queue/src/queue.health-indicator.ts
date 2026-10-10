import {
  HealthCheckRegistry,
  type HealthIndicatorResult,
  HealthIndicatorService,
} from "@nest-boot/health-check";
import {
  Injectable,
  type OnApplicationBootstrap,
  Optional,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { Queue } from "bullmq";

/** Registers health checks for the application's existing BullMQ queues. */
@Injectable()
export class QueueHealthIndicator implements OnApplicationBootstrap {
  private readonly healthIndicator = new HealthIndicatorService();
  private readonly pendingReads = new WeakMap<Queue, Promise<boolean>>();

  /**
   * Creates a queue health indicator without creating queues or Redis connections.
   * @param discoveryService - Provider discovery for registered queue instances
   * @param registry - Optional application health check registry
   */
  constructor(
    private readonly discoveryService: DiscoveryService,
    @Optional() private readonly registry?: HealthCheckRegistry,
  ) {}

  /** Registers one check per queue instance after application modules initialize. */
  onApplicationBootstrap(): void {
    if (!this.registry) return;
    const queues = new Set<Queue>();
    for (const provider of this.discoveryService.getProviders()) {
      if (provider.instance instanceof Queue) queues.add(provider.instance);
    }
    for (const queue of queues) {
      this.registry.register(() => this.check(`queue.${queue.name}`, queue));
    }
  }

  /**
   * Checks connection readiness and reads queue pause state within the timeout.
   * @param key - Unique indicator key
   * @param queue - Existing queue to check, including custom Queue subclasses
   * @param timeout - Maximum check duration in milliseconds, defaults to 1000
   * @returns An up or down result; paused queues remain healthy
   */
  async check(
    key: string,
    queue: Queue,
    timeout = 1000,
  ): Promise<HealthIndicatorResult> {
    return await this.healthIndicator
      .check(key)
      .attempt(async ({ signal }) => {
        if (queue.closing) throw new Error("Queue is closing");
        const client = await queue.client;
        signal.throwIfAborted();
        if (client.status !== "ready")
          throw new Error("Queue connection is not ready");
        // Share commands that outlive a timeout instead of queueing more reads.
        let read = this.pendingReads.get(queue);
        if (!read) {
          read = queue
            .isPaused()
            .finally(() => this.pendingReads.delete(queue));
          this.pendingReads.set(queue, read);
        }
        return { paused: await read };
      })
      .withTimeout(timeout);
  }
}
