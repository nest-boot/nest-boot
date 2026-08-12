import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { RequestContext } from "@nest-boot/request-context";
import { type DynamicModule, type Type } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { TEMPORARY_DIRECTORY_ROOT } from "./temporary-directory.constants";
import { TemporaryDirectoryModule } from "./temporary-directory.module";

describe("TemporaryDirectoryModule", () => {
  const modules: TestingModule[] = [];
  const fixtures: string[] = [];

  afterEach(async () => {
    await Promise.all(
      modules.splice(0).map(async (module) => {
        await module.close();
      }),
    );
    await Promise.all(
      fixtures.splice(0).map(async (fixture) => {
        await rm(fixture, { force: true, recursive: true });
      }),
    );
  });

  it.each([
    ["static", TemporaryDirectoryModule],
    ["register default", TemporaryDirectoryModule.register({})],
    ["register empty", TemporaryDirectoryModule.register({ basePath: "" })],
    [
      "registerAsync default",
      TemporaryDirectoryModule.registerAsync({ useFactory: () => ({}) }),
    ],
  ])("uses the system temp directory for %s", async (_name, imported) => {
    await compile(imported);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);

      if (!root) {
        throw new Error("Temporary directory root was not initialized");
      }

      expect(dirname(root)).toBe(tmpdir());
      expect(basename(root)).toMatch(
        /^nest-boot-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      await expect(stat(root)).resolves.toBeDefined();
    });
  });

  it("uses an absolute configured base path and preserves it", async () => {
    const basePath = await createFixture();
    await compile(TemporaryDirectoryModule.register({ basePath }));
    let root = "";

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      root = requireRoot();
      expect(dirname(root)).toBe(basePath);
    });

    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(basePath)).resolves.toBeDefined();
  });

  it("resolves a relative configured base path from the working directory", async () => {
    const originalCwd = process.cwd();
    const workingDirectory = await createFixture();

    try {
      process.chdir(workingDirectory);
      const resolvedWorkingDirectory = process.cwd();
      await compile(
        TemporaryDirectoryModule.register({ basePath: "var/temp" }),
      );

      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const root = requireRoot();
        expect(dirname(root)).toBe(join(resolvedWorkingDirectory, "var/temp"));
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates a missing configured base path", async () => {
    const fixture = await createFixture();
    const basePath = join(fixture, "nested", "temp");
    await compile(TemporaryDirectoryModule.register({ basePath }));

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(stat(basePath)).resolves.toBeDefined();
    });

    await expect(stat(basePath)).resolves.toBeDefined();
  });

  it("removes the request root after successful completion", async () => {
    const basePath = await createFixture();
    await compile(TemporaryDirectoryModule.register({ basePath }));
    let root = "";

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      root = requireRoot();
      await mkdir(join(root, "content"));
      await expect(stat(root)).resolves.toBeDefined();
    });

    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes the request root when the context callback throws", async () => {
    const basePath = await createFixture();
    await compile(TemporaryDirectoryModule.register({ basePath }));
    const expected = new Error("callback failed");
    let root = "";

    await expect(
      RequestContext.run(new RequestContext({ type: "test" }), () => {
        root = requireRoot();
        throw expected;
      }),
    ).rejects.toBe(expected);

    await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(basePath)).resolves.toBeDefined();
  });

  async function compile(
    imported: Type | DynamicModule,
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [imported],
    }).compile();
    modules.push(module);
    return module;
  }

  async function createFixture(): Promise<string> {
    const fixture = await mkdtemp(join(tmpdir(), "temporary-directory-test-"));
    fixtures.push(fixture);
    return fixture;
  }

  function requireRoot(): string {
    const root = RequestContext.get<string>(TEMPORARY_DIRECTORY_ROOT);
    if (!root) {
      throw new Error("Temporary directory root was not initialized");
    }
    return root;
  }
});
