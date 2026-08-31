import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import { Test, type TestingModule } from "@nestjs/testing";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants.js";
import { TemporaryDirectoryModule } from "./temporary-directory.module.js";

describe("TemporaryDirectoryModule", () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(
      modules.splice(0).map(async (module) => {
        await module.close();
      }),
    );
  });

  it("uses the system temporary directory", async () => {
    await compile();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const root = requireRoot();
      expect(dirname(root)).toBe(tmpdir());
      expect(basename(root)).toMatch(/^nest-boot-.{6}$/);
      await expect(stat(root)).resolves.toBeDefined();
    });
  });

  it("removes the request root after successful completion", async () => {
    await compile();
    let root = "";

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      root = requireRoot();
      await mkdir(join(root, "content"));
      await expect(stat(root)).resolves.toBeDefined();
    });

    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes the request root when the context callback throws", async () => {
    await compile();
    const expected = new Error("callback failed");
    let root = "";

    await expect(
      RequestContext.run(new RequestContext({ type: "test" }), () => {
        root = requireRoot();
        throw expected;
      }),
    ).rejects.toBe(expected);

    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  async function compile(): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [TemporaryDirectoryModule],
    }).compile();
    modules.push(module);
    return module;
  }

  function requireRoot(): string {
    const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);
    if (!root) {
      throw new Error("Temporary directory root was not initialized");
    }
    return root;
  }
});
