import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import nestBoot from "@nest-boot/eslint";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";

const { configs } = nestBoot;
const config = configs.recommended;

describe("eslint config consumer integration", () => {
  let fixtureDirectory: string;

  beforeEach(async () => {
    fixtureDirectory = await mkdtemp(join(process.cwd(), ".eslint-e2e-"));
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

    expect(validResult.errorCount).toBe(0);
    expect(invalidResult.messages).toEqual(
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
    [
      "nest-boot/graphql/field-definite-assignment",
      `import { Field, ObjectType } from "@nestjs/graphql";
@ObjectType()
export class Book {
  @Field()
  title: string;
}
`,
    ],
    [
      "nest-boot/database/entity-property-definite-assignment",
      `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
export class Book {
  @Property()
  title: string;
}
`,
    ],
  ])("reports and suppresses %s by its namespaced ID", async (ruleId, code) => {
    const sourceFile = join(fixtureDirectory, "book.ts");
    const suppressedFile = join(fixtureDirectory, "suppressed-book.ts");
    await Promise.all([
      writeFile(sourceFile, code),
      writeFile(suppressedFile, `/* eslint-disable ${ruleId} */\n${code}`),
    ]);
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });

    const [reported, suppressed] = await eslint.lintFiles([
      sourceFile,
      suppressedFile,
    ]);

    expect(reported.messages).toContainEqual(
      expect.objectContaining({ ruleId, severity: 2 }),
    );
    expect(suppressed.messages).not.toContainEqual(
      expect.objectContaining({ ruleId }),
    );
    expect(suppressed.suppressedMessages).toContainEqual(
      expect.objectContaining({ ruleId, severity: 2 }),
    );
  });

  it("checks processor names through the nest-boot plugin", async () => {
    const validFile = join(fixtureDirectory, "processor.ts");
    const invalidFile = join(fixtureDirectory, "wrong-processor.ts");
    const code = `import { Processor as Consume } from "@nest-boot/queue";
class EmailQueue {}
@Consume(EmailQueue)
export class EmailProcessor {}
`;
    await Promise.all([
      writeFile(validFile, code),
      writeFile(
        invalidFile,
        code.replace("class EmailProcessor", "class SmsProcessor"),
      ),
    ]);
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });
    const results = await eslint.lintFiles([validFile, invalidFile]);
    const namingMessages = results
      .flatMap((result) => result.messages)
      .filter((message) => message.ruleId === "nest-boot/queue/processor-name");
    expect(namingMessages).toEqual([
      expect.objectContaining({
        severity: 2,
        message: 'Processor for "EmailQueue" must be named "EmailProcessor".',
      }),
    ]);
    expect(
      results.find((result) => result.filePath === validFile)?.messages,
    ).toEqual([]);
  });

  it("requires the Nest Boot GraphQL entry point in consuming projects", async () => {
    const validFile = join(fixtureDirectory, "resolver.ts");
    const invalidFile = join(fixtureDirectory, "upstream-resolver.ts");
    await Promise.all([
      writeFile(validFile, 'export { Query } from "@nest-boot/graphql";\n'),
      writeFile(invalidFile, 'export { Query } from "@nestjs/graphql";\n'),
    ]);
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: config,
      overrideConfigFile: true,
    });

    const [valid, invalid] = await eslint.lintFiles([validFile, invalidFile]);

    expect(valid.messages).toEqual([]);
    expect(invalid.messages).toEqual([
      expect.objectContaining({
        ruleId: "nest-boot/graphql/no-direct-nestjs-import",
        severity: 2,
      }),
    ]);
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

  it("applies only Nest Boot custom rules when using configs.rules", async () => {
    const file = join(fixtureDirectory, "custom-only.ts");
    await writeFile(
      file,
      `import { Query } from "@nestjs/graphql";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
const unusedValue = 42;
/** @param {string} name */
@Entity()
export class Book {
  @Property()
  title: string;
}
export { Query };
`,
    );
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: tsParser,
            parserOptions: { projectService: true },
          },
        },
        ...configs.rules,
      ],
      overrideConfigFile: true,
    });

    const results = await eslint.lintFiles([file]);
    const ruleIds = results[0]?.messages.map((message) => message.ruleId) ?? [];

    expect(ruleIds).toContain("nest-boot/graphql/no-direct-nestjs-import");
    expect(ruleIds).toContain(
      "nest-boot/database/entity-property-definite-assignment",
    );
    expect(ruleIds.every((id) => id?.startsWith("nest-boot/"))).toBe(true);
  });

  it("applies only standard rules when using configs.standard", async () => {
    const file = join(fixtureDirectory, "standard-only.ts");
    await writeFile(
      file,
      `import { Query } from "@nestjs/graphql";
const unusedValue = 42;
export { Query };
`,
    );
    const eslint = new ESLint({
      cwd: fixtureDirectory,
      overrideConfig: configs.standard,
      overrideConfigFile: true,
    });

    const results = await eslint.lintFiles([file]);
    const ruleIds = results[0]?.messages.map((message) => message.ruleId) ?? [];

    expect(ruleIds).toContain("@typescript-eslint/no-unused-vars");
    expect(ruleIds.some((id) => id?.startsWith("nest-boot/"))).toBe(false);
  });
});
