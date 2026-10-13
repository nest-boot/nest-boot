import { Injectable } from "@nestjs/common";
import { ContextIdFactory } from "@nestjs/core";
import { Test } from "@nestjs/testing";

import { RequestContext } from "./request-context.js";
import { RequestContextModule } from "./request-context.module.js";

it("injects the active context and propagates request scope without sharing concurrent contexts", async () => {
  @Injectable()
  class Service {
    constructor(readonly context: RequestContext) {}
  }
  const module = await Test.createTestingModule({
    imports: [RequestContextModule],
    providers: [Service],
  }).compile();
  try {
    const contexts = [
      new RequestContext({ type: "queue" }),
      new RequestContext({ type: "http" }),
    ];
    const services = await Promise.all(
      contexts.map(
        async (context) =>
          await RequestContext.run(context, async () => {
            const id = ContextIdFactory.create();
            const service = await module.resolve(Service, id);
            await Promise.resolve();
            expect(service.context).toBe(context);
            expect(await module.resolve(Service, id)).toBe(service);
            return service;
          }),
      ),
    );
    expect(services[0]).not.toBe(services[1]);
    expect(RequestContext.isActive()).toBe(false);
    await expect(
      module.resolve(Service, ContextIdFactory.create()),
    ).rejects.toThrow("Request context is not active");
  } finally {
    await module.close();
  }
});
