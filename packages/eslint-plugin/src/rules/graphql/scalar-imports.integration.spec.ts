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

const cases: {
  name: string;
  imports: string;
  property: string;
  expected: string;
  field?: string;
}[] = [
  {
    name: "type-only scalar reference beside a runtime alias",
    imports:
      'import { Field, ObjectType, Int as Integer, type Int } from "@nest-boot/graphql";',
    property: "@Field(() => Int, { nullable: true }) score?: number;",
    expected: "Integer",
  },
  {
    name: "type-only Field reference beside a runtime alias",
    imports:
      'import { Field as GqlField, ObjectType, type Field } from "@nest-boot/graphql";',
    property: "@Field(() => String, { nullable: true }) name?: string;",
    expected: "String",
    field: "GqlField",
  },
  {
    name: "numeric alias shadowed in an unrelated function",
    imports:
      'import { Field, ObjectType, Int as Integer } from "@nest-boot/graphql"; function other(Integer: number) { return Integer; }',
    property: "@Field(() => Integer) score?: number;",
    expected: "Integer",
  },
  {
    name: "namespace numeric scalar and decorator",
    imports:
      'import { ObjectType } from "@nest-boot/graphql"; import * as gql from "@nest-boot/graphql";',
    property: "@gql.Field(() => gql.Int) score?: number;",
    expected: "Int",
  },
  {
    name: "namespace MikroORM wrapper",
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql"; import type * as orm from "@mikro-orm/core";',
    property: "name?: orm.Opt<string>;",
    expected: "String",
  },
  {
    name: "aliased MikroORM optional wrapper",
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql"; import type { Opt as Optional } from "@mikro-orm/core";',
    property: "name?: Optional<string>;",
    expected: "String",
  },
  {
    name: "aliased MikroORM reference wrapper",
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql"; import type { Ref as Reference } from "@mikro-orm/core"; @ObjectType() class Related {}',
    property: "relation?: Reference<Related>;",
    expected: "Related",
  },
  ...["Float", "GraphQLJSONObject"].map((name) => ({
    name: `custom object type named ${name}`,
    imports: `import { Field, ObjectType } from "@nest-boot/graphql"; @ObjectType() class ${name} {}`,
    property: `value?: ${name};`,
    expected: name,
  })),
  ...[
    {
      imports: "import { GraphQLJSONObject } from 'graphql-type-json';",
      expected: "GraphQLJSONObject",
    },
    {
      imports:
        'import { GraphQLJSONObject as JSONObject } from "graphql-type-json";',
      expected: "JSONObject",
    },
    {
      imports:
        'import type { GraphQLJSONObject as JSONObject, GraphQLJSON } from "graphql-type-json";',
      expected: "JSONObject",
    },
    {
      imports: 'import { type GraphQLJSONObject } from "graphql-type-json";',
      expected: "GraphQLJSONObject",
    },
    {
      imports:
        'import { "GraphQLJSONObject" as GraphQLJSONObject } from "graphql-type-json";',
      expected: "GraphQLJSONObject",
    },
    {
      imports:
        'import Json from "graphql-type-json"; // GraphQLJSONObject is not imported',
      expected: "GraphQLJSONObject",
    },
    {
      imports: 'import * as GraphQLJSONObject from "graphql-type-json";',
      expected: "GraphQLJSONObject2",
    },
    { imports: "const GraphQLJSONObject = 1;", expected: "GraphQLJSONObject2" },
  ].map(({ imports, expected }) => ({
    name: `JSON scalar: ${imports}`,
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql";\n' + imports,
    property: "data?: Record<string, unknown>;",
    expected,
  })),
  {
    name: "type-only scalar alias",
    imports:
      'import { Field, ObjectType, type ID as Identifier } from "@nest-boot/graphql";',
    property: "id?: string;",
    expected: "Identifier",
  },
  {
    name: "quoted scalar import",
    imports:
      'import { Field, ObjectType, "Float" as Float } from "@nest-boot/graphql";',
    property: "score?: number;",
    expected: "Float",
  },
  {
    name: "unrelated local scalar binding",
    imports:
      'import { Field, ObjectType } from "@nest-boot/graphql"; const Float = 1;',
    property: "score?: number;",
    expected: "Float2",
  },
  {
    name: "type-only scalar with an already aligned decorator",
    imports:
      'import { Field, ObjectType, type Float } from "@nest-boot/graphql";',
    property: "@Field(() => Float, { nullable: true }) score?: number;",
    expected: "Float",
  },
  {
    name: "missing Field import",
    imports: 'import { ObjectType } from "@nest-boot/graphql";',
    property: "name?: string;",
    expected: "String",
  },
  {
    name: "aliased Field import",
    imports:
      'import { ObjectType, Field as GqlField } from "@nest-boot/graphql";',
    property: "@GqlField(() => String) name?: string;",
    expected: "String",
    field: "GqlField",
  },
  {
    name: "type-only Field import",
    imports: 'import { ObjectType, type Field } from "@nest-boot/graphql";',
    property: "name?: string;",
    expected: "String",
  },
  {
    name: "unrelated local Field binding",
    imports:
      'import { ObjectType } from "@nest-boot/graphql"; const Field = 1;',
    property: "name?: string;",
    expected: "String",
    field: "Field2",
  },

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
  ({ imports, property, expected, field = "Field" }) => {
    const code = `${imports}\n@ObjectType()\nclass Thing { ${property} }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.fixed).toBe(true);
    expect(result.output).toContain(
      `@${field}(() => ${expected}, { nullable: true })`,
    );
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
  // The first compiler run loads the full GraphQL declaration graph, also under CI coverage.
  60_000,
);

it.each([
  {
    name: "model decorator shadowed by a parameter",
    code: 'import { ObjectType as Model } from "@nest-boot/graphql"; function define(Model: () => ClassDecorator) { @Model() class Thing { name!: string; } return Thing; }',
  },
  {
    name: "unrelated nested scalar binding",
    code: 'import { Field, ObjectType, ID } from "@nest-boot/graphql"; @ObjectType() class Thing { @Field(() => ID) id!: string; method(ID: string) { return ID; } }',
  },
  {
    name: "value alias preferred over a type-only canonical import",
    code: 'import { Field, ObjectType, ID as Identifier } from "@nest-boot/graphql"; import type { ID } from "@nest-boot/graphql"; @ObjectType() class Thing { @Field(() => Identifier) id!: string; }',
  },
  {
    name: "aliased relation decorator",
    code: 'import { Field, ObjectType } from "@nest-boot/graphql"; import { ManyToOne as Relation } from "@mikro-orm/decorators/legacy"; @ObjectType() class Thing { @Relation(() => Thing) relation!: Thing; }',
  },
])(
  "leaves valid $name unchanged",
  ({ code }) => {
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toBe(code);
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
  60_000,
);

it("avoids bindings visible inside a nested model class", () => {
  const code =
    'import { ObjectType, Field, Float } from "@nest-boot/graphql"; function define(Field: number, Float: number) { @ObjectType() class Thing { score?: number; } return Thing; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Field2(() => Float2, { nullable: true })");
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it("recognizes a namespace model decorator", () => {
  const code =
    'import * as gql from "@nest-boot/graphql"; @gql.ObjectType() class Thing { score?: number; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Field(() => Float, { nullable: true })");
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
});

const options: ts.CompilerOptions = {
  noEmit: true,
  experimentalDecorators: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2023,
  skipLibCheck: true,
  types: [],
  paths: {
    "@mikro-orm/decorators/legacy": [
      path.resolve(
        packageRoot,
        "../mikro-orm/node_modules/@mikro-orm/decorators/legacy/index.d.ts",
      ),
    ],
    "@mikro-orm/core": [
      path.resolve(
        packageRoot,
        "../mikro-orm/node_modules/@mikro-orm/core/index.d.ts",
      ),
    ],
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
