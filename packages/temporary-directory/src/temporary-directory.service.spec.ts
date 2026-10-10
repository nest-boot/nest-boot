import { stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";

import { TemporaryDirectoryModule } from "./temporary-directory.module.js";
import { TemporaryDirectoryService } from "./temporary-directory.service.js";

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

  it("creates ungrouped random children inside the request root", async () => {
    new TemporaryDirectoryModule();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const [first, second] = await Promise.all([
        service.create(),
        service.create(),
      ]);

      expect(first).not.toBe(second);
      expect(dirname(first)).toBe(dirname(second));
      expect(basename(first)).toHaveLength(6);
      expect(basename(second)).toHaveLength(6);
      await expect(stat(first)).resolves.toBeDefined();
      await expect(stat(second)).resolves.toBeDefined();
    });
  });

  it("creates random children inside a shared namespace", async () => {
    new TemporaryDirectoryModule();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const [first, second] = await Promise.all([
        service.create("image-cache_2"),
        service.create("image-cache_2"),
      ]);

      expect(first).not.toBe(second);
      expect(dirname(first)).toBe(dirname(second));
      expect(basename(dirname(first))).toBe("image-cache_2");
      expect(basename(first)).toHaveLength(6);
      expect(basename(second)).toHaveLength(6);
      await expect(stat(first)).resolves.toBeDefined();
      await expect(stat(second)).resolves.toBeDefined();
    });
  });

  it("accepts a 64-character namespace", async () => {
    new TemporaryDirectoryModule();
    const namespace = `A${"a".repeat(61)}_2`;

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const path = await service.create(namespace);

      expect(basename(dirname(path))).toBe(namespace);
      expect(basename(path)).toHaveLength(6);
    });
  });

  it.each([
    "",
    "a".repeat(65),
    ".",
    "..",
    "../image",
    "foo/bar",
    "foo\\bar",
    "image.v2",
    "图片",
    "image cache",
  ])("rejects the invalid namespace %j", async (namespace) => {
    new TemporaryDirectoryModule();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(service.create(namespace)).rejects.toEqual(
        new TypeError(
          "Temporary directory namespace must be 1-64 characters using only letters, numbers, hyphens, and underscores",
        ),
      );
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
    let namespacePath = "";

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      path = await service.create("audio");
      namespacePath = dirname(path);
      await writeFile(join(path, "input"), "audio");
      await expect(stat(path)).resolves.toBeDefined();
    });

    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(namespacePath)).rejects.toMatchObject({ code: "ENOENT" });
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
