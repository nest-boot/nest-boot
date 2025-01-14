import { Injectable, Logger } from "@nestjs/common";

import { QueueExplorer } from "./queue.explorer";

@Injectable()
export class QueueManager {
  constructor(
    private readonly logger: Logger,
    private readonly queueExplorer: QueueExplorer,
  ) {}

  get(name: string) {
    return this.queueExplorer.queueMap.get(name);
  }

  run(names?: string[]): void {
    [...this.queueExplorer.queueMap.entries()]
      .filter(([name]) => typeof names === "undefined" || names.includes(name))
      .forEach(([name, queue]) => {
        void queue.runWorker();
        this.logger.log(`Queue ${name} worker started`, this.constructor.name);
      });
  }

  runAll(): void {
    this.run([...this.queueExplorer.queueMap.keys()]);
  }
}
