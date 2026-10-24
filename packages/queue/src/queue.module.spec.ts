import { Test } from "@nestjs/testing";

import { QueueManager } from "./queue.manager.js";
import { QueueModule } from "./queue.module.js";

it("initializes Redis queue infrastructure without database, GraphQL, auth or schedule modules", async () => {
  const app = await Test.createTestingModule({
    imports: [QueueModule],
  }).compile();
  try {
    await app.init();
    expect(app.get(QueueManager).getQueues()).toEqual([]);
    expect(await app.get(QueueManager).start()).toEqual([]);
  } finally {
    await app.close();
  }
});
