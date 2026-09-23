import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import importRule from "../import/import-graphql.js";
import rule from "./graphql-field-config-from-types.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
// Real re-exports let the parser and compiler verify the same symbol origins.
const fixtureRoot = path.join(packageRoot, ".cache/graphql-imports");
mkdirSync(fixtureRoot, { recursive: true });
afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});
writeFileSync(
  path.join(fixtureRoot, "barrel.ts"),
  `
export { Field, ObjectType, Int, Float, ID } from "@nestjs/graphql";
export { GraphQLJSONObject } from "graphql-type-json";
export class User {}
export default User;
`,
);
writeFileSync(
  path.join(fixtureRoot, "renamed.ts"),
  `
export { Field as Column, ObjectType as Model, Int as Integer, ID as Identifier } from "./barrel.js";
`,
);
writeFileSync(
  path.join(fixtureRoot, "other.ts"),
  `
export function Field(...args: unknown[]): PropertyDecorator { return () => { void args; }; }
export function ObjectType(): ClassDecorator { return () => undefined; }
`,
);
writeFileSync(
  path.join(fixtureRoot, "mixed.ts"),
  `
export * from "./barrel.js";
export { Field, ObjectType } from "./other.js";
`,
);

const filename = path.join(packageRoot, "v8-autofix-fixture.ts");
const linter = new Linter();
const config: Linter.Config[] = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        // verifyAndFix reparses different source snapshots in this process, including on CI.
        disallowAutomaticSingleRunInference: true,
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
    name: "barrel Field alias",
    imports:
      'import { ObjectType } from "@nest-boot/graphql"; import { Field as GqlField } from "./.cache/graphql-imports/barrel.js";',
    property: "@GqlField(() => String) name?: string;",
    expected: "String",
    field: "GqlField",
  },
  ...[
    'import type { User } from "./.cache/graphql-imports/barrel.js";',
    'import { type User } from "./.cache/graphql-imports/barrel.js";',
    'import type User from "./.cache/graphql-imports/barrel.js";',
  ].flatMap((customImport) =>
    [true, false].map((existing) => ({
      name: `custom runtime type ${customImport}, existing decorator: ${String(existing)}`,
      imports:
        'import { Field, ObjectType } from "@nest-boot/graphql"; ' +
        customImport,
      property: `${existing ? "@Field(() => User, { nullable: true }) " : ""} user?: User;`,
      expected: "User",
    })),
  ),
  {
    name: "shared type-only barrel declaration",
    imports:
      'import { ObjectType } from "@nest-boot/graphql"; import type { User, Field } from "./.cache/graphql-imports/barrel.js";',
    property: "@Field(() => User, { nullable: true }) user?: User;",
    expected: "User",
  },

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
    expected: "gql.Int",
    field: "gql.Field",
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

it("recognizes a model decorator alias re-exported through a barrel", () => {
  const code =
    'import { ObjectType as Model, Field } from "./.cache/graphql-imports/barrel.js"; @Model() class Thing { name?: string; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Field(() => String, { nullable: true })");
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
});

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

function compileDiagnostics(code: string, noUnusedLocals = false): string[] {
  const compilerOptions = { ...options, noUnusedLocals };
  const host = ts.createCompilerHost(compilerOptions);
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
  const program = ts.createProgram(
    [filename],
    compilerOptions,
    host,
    previousProgram,
  );
  previousProgram = program;
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}

it.each([true, false])(
  "does not reuse an unrelated Field (canonical alias: %s)",
  (withAlias) => {
    const code = `import { Field } from "./.cache/graphql-imports/other.js";
import { ${withAlias ? "Field as GqlField, " : ""}ObjectType } from "@nestjs/graphql";
@ObjectType() class Thing { name!: string; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toContain(
      `@${withAlias ? "GqlField" : "Field2"}(() => String)`,
    );
    expect(result.output).not.toContain("@Field(");
    expect(compileDiagnostics(result.output)).toEqual([]);
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
  },
);

it.each(["other", "mixed"])(
  "ignores an unrelated model exported by %s",
  (barrel) => {
    const code = `import { ObjectType as Model } from "./.cache/graphql-imports/${barrel}.js"; @Model() class Thing { name!: string; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.output).toBe(code);
    expect(result.messages).toEqual([]);
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
);

it.each([
  {
    imports: 'import { Int } from "./.cache/graphql-imports/barrel.js";',
    scalar: "Int",
    property: "score!: number",
  },
  {
    imports: 'import { ID } from "./.cache/graphql-imports/barrel.js";',
    scalar: "ID",
    property: "id!: string",
  },
  {
    imports: 'import { Integer } from "./.cache/graphql-imports/renamed.js";',
    scalar: "[Integer]",
    property: "scores!: number[]",
  },
  {
    imports: 'import * as scalars from "./.cache/graphql-imports/barrel.js";',
    scalar: "scalars.ID",
    property: "id!: string",
  },
])(
  "preserves a valid explicit barrel $scalar",
  ({ imports, scalar, property }) => {
    const code = `import { Field, ObjectType } from "@nest-boot/graphql"; ${imports} @ObjectType() class Thing { @Field(() => ${scalar}) ${property}; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toBe(code);
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
);

it.each([
  {
    imports: 'import { Int } from "./.cache/graphql-imports/barrel.js";',
    scalar: "Int",
    property: "score?: number",
  },
  {
    imports:
      'import { Identifier } from "./.cache/graphql-imports/renamed.js";',
    scalar: "Identifier",
    property: "id?: string",
  },
  {
    imports: 'import * as scalars from "./.cache/graphql-imports/barrel.js";',
    scalar: "[scalars.Int]",
    property: "scores?: number[]",
  },
  {
    imports:
      'import { GraphQLJSONObject as Json } from "./.cache/graphql-imports/barrel.js";',
    scalar: "Json",
    property: "data?: Record<string, unknown>",
  },
])(
  "retains explicit $scalar while correcting nullability",
  ({ imports, scalar, property }) => {
    const code = `import { Field, ObjectType } from "@nestjs/graphql"; ${imports} @ObjectType() class Thing { @Field(() => ${scalar}) ${property}; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toContain(
      `@Field(() => ${scalar}, { nullable: true })`,
    );
    expect(compileDiagnostics(result.output)).toEqual([]);
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
  },
);

it("reuses renamed model and field exports through a second barrel", () => {
  const code =
    'import { Model, Column } from "./.cache/graphql-imports/renamed.js"; @Model() class Thing { name!: string; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Column(() => String)");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  'import type { ObjectType, Field, Int } from "./.cache/graphql-imports/barrel.js"; @ObjectType() class Thing { @Field(() => Int) score?: number; }',
  'import type * as gql from "./.cache/graphql-imports/barrel.js"; @gql.ObjectType() class Thing { @gql.Field(() => gql.Int) score?: number; }',
  'import { ObjectType, Field } from "@nest-boot/graphql"; import { type Integer } from "./.cache/graphql-imports/renamed.js"; @ObjectType() class Thing { @Field(() => Integer) score?: number; }',
])("promotes erased barrel runtime references and stabilizes: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).not.toContain("Float");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it("checks individual export identities in a mixed barrel", () => {
  const code =
    'import { ObjectType } from "@nestjs/graphql"; import { Field, Int } from "./.cache/graphql-imports/mixed.js"; @ObjectType() class Thing { @Field(() => Int) score!: number; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Field(() => Int)");
  expect(result.output).toContain("@Field2(() => Float)");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  ["@nestjs/graphql", "ObjectType", "Field", "Int"],
  ["./.cache/graphql-imports/barrel.js", "ObjectType", "Field", "Int"],
  ["./.cache/graphql-imports/renamed.js", "Model", "Column", "Integer"],
])(
  "recognizes const-destructured decorators and scalars from %s",
  (module, model, field, scalar) => {
    const code = `import * as gql from "${module}";
const { ${model}: Model, ${field}: Column, ${scalar}: Integer } = gql;
@Model() export class Thing { @Column(() => Integer) score?: number; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toContain(
      "@Column(() => Integer, { nullable: true })",
    );
    expect(result.output).not.toContain("Float");
    expect(compileDiagnostics(result.output, true)).toEqual([]);
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
  },
);

it.each([
  ["Int", "[Value]", "scores?: number[]"],
  ["ID", "Value", "id?: string"],
  ["GraphQLJSONObject", "Value", "data?: Record<string, unknown>"],
])(
  "retains destructured %s when correcting nullability",
  (scalar, expression, property) => {
    const code = `import * as gql from "./.cache/graphql-imports/barrel.js";
const { ObjectType: Model, Field: Column, ${scalar}: Value } = gql;
@Model() export class Thing { @Column(() => ${expression}) ${property}; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toContain(
      `@Column(() => ${expression}, { nullable: true })`,
    );
    expect(compileDiagnostics(result.output, true)).toEqual([]);
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
  },
);
