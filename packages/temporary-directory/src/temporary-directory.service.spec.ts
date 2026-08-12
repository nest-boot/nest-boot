import { stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";

import { TemporaryDirectoryModule } from "./temporary-directory.module";
import { TemporaryDirectoryService } from "./temporary-directory.service";

describe("TemporaryDirectoryService", () => {
  const service = new TemporaryDirectoryService();

  it("rejects creation outside an active request context", async () => {
    await expect(service.create()).rejects.toThrow(
      "Temporary directory requires an active RequestContext",
    );
  });

  it("rejects creation when the context root is not initialized", async () => {
    RequestContext.registerMiddleware(
      "temporary-directory",
      async (_context, next) => await next(),
    );

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(service.create()).rejects.toThrow(
        "Temporary directory context is not initialized",
      );
    });
  });

  it("creates distinct children in the same request root", async () => {
    new TemporaryDirectoryModule();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const [first, second] = await Promise.all([
        service.create(),
        service.create(),
      ]);

      expect(first).not.toBe(second);
      expect(dirname(first)).toBe(dirname(second));
      await expect(stat(first)).resolves.toBeDefined();
      await expect(stat(second)).resolves.toBeDefined();
    });
  });

  it("isolates concurrent request contexts", async () => {
    new TemporaryDirectoryModule();

    const paths = await Promise.all(
      ["first", "second"].map(
        async () =>
          await RequestContext.run(
            new RequestContext({ type: "test" }),
            async () => await service.create(),
          ),
      ),
    );

    expect(dirname(paths[0])).not.toBe(dirname(paths[1]));
  });

  it("removes child contents after successful completion", async () => {
    new TemporaryDirectoryModule();
    let path = "";

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      path = await service.create();
      await writeFile(join(path, "input"), "audio");
      await expect(stat(path)).resolves.toBeDefined();
    });

    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes child contents when the context callback throws", async () => {
    new TemporaryDirectoryModule();
    const expected = new Error("callback failed");
    let path = "";

    await expect(
      RequestContext.run(new RequestContext({ type: "test" }), async () => {
        path = await service.create();
        await writeFile(join(path, "input"), "audio");
        throw expected;
      }),
    ).rejects.toBe(expected);

    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
