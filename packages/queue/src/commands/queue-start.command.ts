import { BaseCommand, Command, Option } from "@nest-boot/command";
import { Inject } from "@nestjs/common";

import { QueueManager } from "../queue.manager.js";

/** Runs selected queue consumers in the foreground until interrupted. */
@Command({
  paths: [["queue:start"]],
  usage: { description: "Run queue workers until SIGINT or SIGTERM." },
})
export class QueueStartCommand extends BaseCommand {
  /** Queue names; repeat the option to run multiple queues. */
  queues = Option.Array("--queue", {
    description: "Registered queue name; omit to run all queues.",
  });

  constructor(@Inject(QueueManager) private readonly manager: QueueManager) {
    super();
  }

  /** Starts consumers and lets CommandFactory close the application on shutdown. */
  async execute(): Promise<void> {
    let finish!: () => void;
    const interrupted = new Promise<void>((resolve) => {
      finish = () => {
        resolve();
      };
    });
    process.on("SIGINT", finish);
    process.on("SIGTERM", finish);
    try {
      const names = await Promise.race([
        this.manager.start(this.queues),
        interrupted,
      ]);
      if (!names) {
        return;
      }
      if (!names.length) {
        throw new Error(
          "No queue processors are registered for the selected queues.",
        );
      }
      this.context.stdout.write(
        `Queue workers running: ${names.join(", ")}.\n`,
      );
      await Promise.race([interrupted, this.manager.waitForStop()]);
    } finally {
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
    }
  }
}
