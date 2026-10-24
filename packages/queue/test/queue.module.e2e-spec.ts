import { Test } from "@nestjs/testing";

import { QueueManager } from "../dist/index.js";
import { createRedisFixture } from "./redis.fixture.js";
import { AppModule } from "./src/app.module.js";
import { ReportsQueue } from "./src/app/worker/reports.queue.js";

it("enqueues and processes jobs through Redis", async () => {
  const fixture = await createRedisFixture();
  vi.stubEnv("QUEUE_TEST_PREFIX", fixture.prefix);
  const app = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  try {
    await app.init();
    const job = await app.get(ReportsQueue).add("report", {});
    expect(await job.getState()).toBe("waiting");
    await app.get(QueueManager).start(["reports"]);
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("completed");
    });
  } finally {
    await app.close();
    await fixture.close();
    vi.unstubAllEnvs();
  }
});
