import { Test } from "@nestjs/testing";

import { QueueModule } from "./queue.module.js";
import { MODULE_OPTIONS_TOKEN } from "./queue.module-definition.js";

it.each(["default", "sync", "async"])("uses %s root options", async (mode) => {
  const options = { connection: { schema: "test" }, graphql: false };
  const module = await Test.createTestingModule({
    imports: [
      mode === "default"
        ? QueueModule
        : mode === "sync"
          ? QueueModule.forRoot(options)
          : QueueModule.forRootAsync({ useFactory: () => options }),
    ],
  }).compile();
  try {
    expect(module.get(MODULE_OPTIONS_TOKEN)).toEqual(
      mode === "default" ? {} : options,
    );
  } finally {
    await module.close();
  }
});
