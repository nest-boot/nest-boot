import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const packageRoot = resolve(import.meta.dirname, "..");

describe("VectorType public declarations", () => {
  it("should compile a standalone consumer of the built package", () => {
    const directory = mkdtempSync(join(tmpdir(), "nest-boot-vector-consumer-"));

    try {
      mkdirSync(join(directory, "node_modules", "@nest-boot"), {
        recursive: true,
      });
      symlinkSync(
        packageRoot,
        join(directory, "node_modules", "@nest-boot", "database"),
        "dir",
      );
      symlinkSync(
        join(packageRoot, "node_modules", "@mikro-orm"),
        join(directory, "node_modules", "@mikro-orm"),
        "dir",
      );
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      writeFileSync(
        join(directory, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            module: "NodeNext",
            target: "ES2023",
            strict: true,
            experimentalDecorators: true,
            skipLibCheck: true,
            noEmit: true,
            types: [],
          },
          files: ["consumer.ts"],
        }),
      );
      writeFileSync(
        join(directory, "consumer.ts"),
        `import { Type } from "@mikro-orm/core";
import { Property } from "@mikro-orm/decorators/legacy";
import { VectorType } from "@nest-boot/database";

class Document {
  @Property({ type: new VectorType(1536), nullable: true })
  embedding?: number[];

  @Property({ type: VectorType })
  vector!: number[];
}

const type: Type<number[] | null, string | null> = new VectorType(3);
const cached: VectorType = Type.getType(VectorType);
`,
      );

      const result = spawnSync(
        process.execPath,
        [require.resolve("typescript/bin/tsc"), "-p", directory],
        { encoding: "utf8", timeout: 15_000 },
      );

      expect(result.error).toBeUndefined();
      expect(result.stdout + result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
