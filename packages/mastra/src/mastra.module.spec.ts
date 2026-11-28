import { BodyLimitMiddleware, JsonBodyMiddleware } from "@mastra/nestjs";
import type { MiddlewareConsumer } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";

import { MastraController } from "./mastra.controller.js";
import { MastraModule } from "./mastra.module.js";
import { MastraStudioMiddleware } from "./mastra-studio.middleware.js";

describe("MastraModule (unit)", () => {
  it("builds headless DynamicModule by default in forRoot and attaches dynamic controller when server is enabled or async", () => {
    const headless = MastraModule.forRoot();
    expect(headless.controllers).toBeUndefined();

    const explicitHeadless = MastraModule.forRoot({
      server: { enabled: false },
    });
    expect(explicitHeadless.controllers).toBeUndefined();

    const withServer = MastraModule.forRoot({ server: true });
    expect(withServer.controllers).toHaveLength(1);

    const asyncModule = MastraModule.forRootAsync({
      useFactory: () => ({}),
    });
    expect(asyncModule.controllers).toHaveLength(1);
  });

  it("configures Studio and body-parsing middlewares only when enabled", () => {
    const applied: { middlewares: unknown[]; routes: unknown[] }[] = [];
    const mockConsumer: MiddlewareConsumer = {
      apply: (...middlewares: unknown[]) => ({
        exclude: () => {
          throw new Error("Unexpected exclude");
        },
        forRoutes: (...routes: unknown[]) => {
          applied.push({ middlewares, routes });
          return mockConsumer;
        },
      }),
    };

    new MastraModule({}).configure(mockConsumer);
    expect(applied).toEqual([]);

    class DynamicMastraController extends MastraController {}
    new MastraModule(
      { server: { prefix: "/custom/mastra" }, studio: true },
      DynamicMastraController,
    ).configure(mockConsumer);

    expect(applied).toEqual([
      {
        middlewares: [MastraStudioMiddleware],
        routes: [
          { path: "/custom/mastra/studio", method: RequestMethod.GET },
          { path: "/custom/mastra/studio/{*path}", method: RequestMethod.GET },
        ],
      },
      {
        middlewares: [BodyLimitMiddleware, JsonBodyMiddleware],
        routes: [DynamicMastraController],
      },
    ]);
  });
});
