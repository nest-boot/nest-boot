import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import config from "@nest-boot/eslint-config";
import { ESLint } from "eslint";

describe("eslint config consumer integration", () => {
  let fixtureDirectory: string;

  beforeEach(async () => {
    fixtureDirectory = await mkdtemp(
      join(process.cwd(), ".eslint-config-e2e-"),
    );
    await Promise.all([
      writeFile(
        join(fixtureDirectory, "package.json"),
        JSON.stringify({ private: true, type: "module" }),
      ),
      writeFile(
        join(fixtureDirectory, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            target: "ES2023",
          },
          include: ["*.ts"],
        }),
      ),
    ]);
  });

  afterEach(async () => {
    await rm(fixtureDirectory, { force: true, recursive: true });
  });

  it("lints TypeScript from a consuming project", async () => {
    const validFile = join(fixtureDirectory, "valid.ts");
    const invalidFile = join(fixtureDirectory, "invalid.ts");
    await Promise.all([
      writeFile(validFile, "export const answer = 42;\n"),
      writeFile(invalidFile, "const unusedValue = 42;\nexport {};\n"),
    ]);
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });

    const validResults = await eslint.lintFiles([validFile]);
    const invalidResults = await eslint.lintFiles([invalidFile]);
    const validResult = validResults[0];
    const invalidResult = invalidResults[0];

    expect(validResult?.errorCount).toBe(0);
    expect(invalidResult?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-unused-vars",
          severity: 2,
        }),
      ]),
    );
  });

  it("accepts JSDoc with TypeScript-inferred types and template tags", async () => {
    const file = join(fixtureDirectory, "documented.ts");
    await writeFile(
      file,
      `/**
 * Returns the supplied value unchanged.
 * @template T - The value type.
 * @param value - The value to return.
 * @returns The original value.
 */
export function identity<T>(value: T): T {
  return value;
}
`,
    );
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });

    const results = await eslint.lintFiles([file]);

    expect(results[0]?.messages).toEqual([]);
  });

  it.each([
    ["@typeParam T - The value type.", "jsdoc/check-tag-names"],
    ["@param {T} value - The value to return.", "jsdoc/no-types"],
    ["@param other - The value to return.", "jsdoc/check-param-names"],
    ["@throws When the value is invalid.", "jsdoc/require-throws-type"],
  ])("rejects nonstandard documentation: %s", async (tag, ruleId) => {
    const file = join(fixtureDirectory, "invalid-docs.ts");
    await writeFile(
      file,
      `/**
 * Returns the supplied value unchanged.
 * ${tag}
 * @returns The original value.
 */
export function identity<T>(value: T): T {
  return value;
}
`,
    );
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });

    const results = await eslint.lintFiles([file]);

    expect(results[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId, severity: 2 }),
      ]),
    );
  });
});
