import { LoggerModule } from "@nest-boot/logger";
import { Test } from "@nestjs/testing";

import { GraphQLLoggerModule } from "../src/graphql-logger.module.js";
import { MODULE_OPTIONS_TOKEN } from "../src/graphql-logger.module-definition.js";
import { GraphQLLoggerPlugin } from "../src/graphql-logger.plugin.js";

describe("GraphQLLoggerModule", () => {
  it("registers the plugin synchronously", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.register({ enabled: false }),
        GraphQLLoggerModule.forRoot({}),
      ],
    }).compile();

    expect(moduleRef.get(GraphQLLoggerPlugin)).toBeInstanceOf(
      GraphQLLoggerPlugin,
    );
    expect(moduleRef.get(MODULE_OPTIONS_TOKEN)).toEqual({});

    await moduleRef.close();
  });

  it("registers the plugin asynchronously", async () => {
    const useFactory = vi.fn(() => Promise.resolve({}));
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.register({ enabled: false }),
        GraphQLLoggerModule.forRootAsync({ useFactory }),
      ],
    }).compile();

    expect(moduleRef.get(GraphQLLoggerPlugin)).toBeInstanceOf(
      GraphQLLoggerPlugin,
    );
    expect(useFactory).toHaveBeenCalledOnce();

    await moduleRef.close();
  });
});
