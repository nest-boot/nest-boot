import { BaseCommand, Command, Option } from "@nest-boot/command";
import { Inject } from "@nestjs/common";

import { QueueRegistrar } from "../queue.registrar.js";

/** Runs selected queue consumers in the foreground until interrupted. */
@Command({
  paths: [["queue:run"]],
  usage: { description: "Run queue workers until SIGINT or SIGTERM." },
})
export class QueueRunCommand extends BaseCommand {
  /** Queue names; repeat the option to run multiple queues. */
  queues = Option.Array("--queue", {
    description: "Registered queue name; omit to run all queues.",
  });

  constructor(
    @Inject(QueueRegistrar) private readonly registrar: QueueRegistrar,
  ) {
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
        this.registrar.start(this.queues),
        interrupted,
      ]);
      if (!names) {
        return;
      }
      if (!names.length) {
        throw new Error(
          "No queue processors or event listeners are registered for the selected queues.",
        );
      }
      this.context.stdout.write(
        `Queue workers running: ${names.join(", ")}.\n`,
      );
      await Promise.race([interrupted, this.registrar.waitForStop()]);
    } finally {
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
    }
  }
}
