import path from "node:path";
import { fileURLToPath } from "node:url";

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import importRule from "../import/import-graphql.js";
import rule from "./graphql-field-config-from-types.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const filename = path.join(packageRoot, "v8-autofix-fixture.ts");
const linter = new Linter();
const config: Linter.Config[] = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        projectService: { allowDefaultProject: ["v8-autofix-fixture.ts"] },
        tsconfigRootDir: packageRoot,
      },
    },
    plugins: {
      test: {
        rules: {
          field: rule as unknown as Rule.RuleModule,
          imports: importRule as unknown as Rule.RuleModule,
        },
      },
    },
    rules: { "test/field": "error", "test/imports": "error" },
  },
];

const cases = [
  ...["@nestjs/graphql", "@nest-boot/graphql"].flatMap((moduleName) =>
    ["ID", "Int", "Float"].map((scalar) => ({
      name: `${scalar} grouped import from ${moduleName}`,
      imports: `import { Field, ObjectType, ${scalar} } from '${moduleName}';`,
      property: `@Field(() => ${scalar}) ${scalar === "ID" ? "id?: string" : "value?: number"};`,
      expected: scalar,
    })),
  ),
  {
    name: "value alias",
    imports:
      'import { Field, ObjectType, ID as Identifier } from "@nest-boot/graphql";',
    property: "@Field(() => Identifier) id?: string;",
    expected: "Identifier",
  },
  {
    name: "numeric alias",
    imports:
      'import { Field, ObjectType, Int as Integer } from "@nest-boot/graphql";',
    property: "@Field(() => [Integer]) counts?: number[];",
    expected: "[Integer]",
  },
  {
    name: "type-only declaration",
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql";\nimport type { ID, FieldOptions } from "@nest-boot/graphql";',
    property: "@Field(() => ID) id?: string;",
    expected: "ID",
  },
  {
    name: "inline type-only binding",
    imports:
      'import { Field, ObjectType, type Float } from "@nest-boot/graphql";',
    property: "@Field(() => Float) score?: number;",
    expected: "Float",
  },
  {
    name: "missing scalar",
    imports: 'import { Field, ObjectType } from "@nest-boot/graphql";',
    property: "id?: string;",
    expected: "ID",
  },
];

it.each(cases)(
  "compiles and stabilizes $name",
  ({ imports, property, expected }) => {
    const code = `${imports}\n@ObjectType()\nclass Thing { ${property} }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.fixed).toBe(true);
    expect(result.output).toContain(
      `@Field(() => ${expected}, { nullable: true })`,
    );
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
  // The first compiler run loads the full GraphQL declaration graph, also under CI coverage.
  60_000,
);

const options: ts.CompilerOptions = {
  noEmit: true,
  experimentalDecorators: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2023,
  skipLibCheck: true,
  types: [],
  paths: {
    "@nest-boot/graphql": [
      path.resolve(packageRoot, "../graphql/dist/index.d.ts"),
    ],
  },
};
const sourceFiles = new Map<string, ts.SourceFile>();
let previousProgram: ts.Program | undefined;

function compileDiagnostics(code: string): string[] {
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) => {
    if (file === filename)
      return ts.createSourceFile(file, code, ts.ScriptTarget.ES2023, true);
    const cached = sourceFiles.get(file);
    if (cached) return cached;
    const source = getSourceFile(file, ...args);
    if (source) sourceFiles.set(file, source);
    return source;
  };
  const program = ts.createProgram([filename], options, host, previousProgram);
  previousProgram = program;
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}
