import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import rule from "./entity-property-config-from-types.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
// Keep executable compiler fixtures out of Nx's production dependency graph.
const fixtureRoot = path.join(packageRoot, ".cache/orm-imports");
mkdirSync(fixtureRoot, { recursive: true });
afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});
writeFileSync(
  path.join(fixtureRoot, "orm-barrel.ts"),
  `export { EncryptedProperty } from "../../../mikro-orm-crypt/dist/index.js";
export { HashedProperty } from "../../../mikro-orm-hash/dist/index.js";
export { type Opt,t } from "@mikro-orm/core";
export { Entity, Property } from "@mikro-orm/decorators/legacy";
`,
);
writeFileSync(
  path.join(fixtureRoot, "orm-mixed-barrel.ts"),
  `export * from "./orm-barrel.js";
export { Entity } from "./other-decorators.js";
`,
);
writeFileSync(
  path.join(fixtureRoot, "orm-renamed-barrel.ts"),
  `export {
  Property as Column,
  Entity as Model,
  EncryptedProperty as Secret,
  t as types,
} from "./orm-barrel.js";
`,
);
writeFileSync(
  path.join(fixtureRoot, "other-decorators.ts"),
  `export function Entity(): ClassDecorator {
  return () => undefined;
}
export function Property(...args: unknown[]): PropertyDecorator {
  return () => {
    void args;
  };
}
export function Field(...args: unknown[]): PropertyDecorator {
  return () => {
    void args;
  };
}
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
      test: { rules: { entity: rule as unknown as Rule.RuleModule } },
    },
    rules: { "test/entity": "error" },
  },
];

const cases = [
  {
    name: "type-only property reference with a runtime alias available",
    imports:
      'import { Entity, Property as Column, type Property } from "@mikro-orm/decorators/legacy"; import { t } from "@mikro-orm/core";',
    property: "@Property({ type: t.string }) name!: string;",
  },
  {
    name: "type-only helper reference with a runtime alias available",
    imports:
      'import { Entity, Property } from "@mikro-orm/decorators/legacy"; import { t as types, type t } from "@mikro-orm/core";',
    property: "@Property({ type: t.uuid }) name!: string;",
  },
  {
    name: "type-only enum reference with a runtime alias available",
    imports:
      'import { Entity, Enum as Choice, type Enum } from "@mikro-orm/decorators/legacy";',
    property: "@Enum({ items: () => Role }) role!: Role;",
  },

  {
    name: "missing Opt reference reuses an imported alias",
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy"; import type { Opt as Optional } from "@mikro-orm/core";',
    property: 'name: Opt<string> = "hello";',
  },
  {
    name: "namespace optional wrapper",
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy"; import * as orm from "@mikro-orm/core";',
    property: 'name: orm.Opt<string> = "hello";',
  },
  ...[
    'import type { Entity, ManyToOne } from "@mikro-orm/core";',
    'import { type Entity, type ManyToOne } from "@mikro-orm/core";',
    'import type { Entity, ManyToOne, Opt } from "@mikro-orm/postgresql";',
    'import { type Entity, type ManyToOne, t } from "@mikro-orm/postgresql";',
  ].map((imports) => ({
    name: `type-only class and relation decorators: ${imports}`,
    imports,
    property: "@ManyToOne(() => Thing) parent!: Thing; name!: string;",
  })),
  {
    name: "custom property decorator binding remains unchanged",
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy"; import { EncryptedProperty as SecureColumn } from "@nest-boot/mikro-orm-crypt";',
    property: "@SecureColumn() name!: string;",
  },
  {
    name: "missing runtime helper while correcting an existing decorator",
    imports: 'import { Entity, Property } from "@mikro-orm/decorators/legacy";',
    property: "@Property() name!: string;",
  },
  {
    name: "type-only helper with an otherwise aligned decorator",
    imports:
      'import { Entity, Property } from "@mikro-orm/decorators/legacy"; import type { t } from "@mikro-orm/core";',
    property: "@Property({ type: t.text }) name!: string;",
  },
  {
    name: "type-only decorator with an otherwise aligned property",
    imports:
      'import { Entity, type Property } from "@mikro-orm/decorators/legacy"; import { t } from "@mikro-orm/core";',
    property: "@Property({ type: t.text }) name!: string;",
  },
  {
    name: "type-only aliased Enum with an otherwise aligned property",
    imports:
      'import { Entity, type Enum as Choice } from "@mikro-orm/decorators/legacy";',
    property: "@Choice({ items: () => Role }) role!: Role;",
  },
  ...[
    {
      imports: 'import { t } from "@mikro-orm/postgresql";',
      property: "name!: string;",
    },
    {
      imports: 'import type { Opt } from "@mikro-orm/postgresql";',
      property: 'name: Opt<string> = "hello";',
    },
    {
      imports: 'import { Opt } from "@mikro-orm/postgresql";',
      property: 'name: string = "hello";',
    },
    {
      imports: 'import type { t, Opt } from "@mikro-orm/postgresql";',
      property: 'name: Opt<string> = "hello";',
    },
    {
      imports:
        'import { t, type Opt, PostgreSqlDriver } from "@mikro-orm/postgresql";',
      property: 'name: Opt<string> = "hello";',
    },
    {
      imports:
        'import { t as ormTypes, type Opt as Optional } from "@mikro-orm/postgresql";',
      property: 'name: Optional<string> = "hello";',
    },
    {
      imports:
        'import type { t as ormTypes, Opt as Optional } from "@mikro-orm/postgresql";',
      property: 'name: string = "hello";',
    },
    {
      imports: 'import { "t" as t, type "Opt" as Opt } from "@mikro-orm/core";',
      property: 'name: Opt<string> = "hello";',
    },
    {
      imports: 'import * as t from "@mikro-orm/core";',
      property: "name!: string;",
    },
    {
      imports: "const t = 1; const Property = 2; type Opt = boolean;",
      property: 'name: string = "hello";',
    },
    { imports: "const Enum = 1;", property: "role!: Role;" },
  ].map(({ imports, property }) => ({
    name: `existing bindings: ${imports}`,
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy";\n' + imports,
    property,
  })),
  {
    name: "helpers and obsolete decorators from a driver",
    imports:
      'import { t, Entity, Property, type Opt, PostgreSqlDriver } from "@mikro-orm/postgresql";',
    property: 'name: Opt<string> = "hello";',
  },
  {
    name: "all driver bindings move to two destinations",
    imports:
      'import { t, Entity, /* keep driver comment */ Property, Opt } from "@mikro-orm/postgresql";',
    property: 'name: Opt<string> = "hello";',
  },
  {
    name: "existing decorator aliases",
    imports:
      'import { Entity, Property as Column, Enum as Choice } from "@mikro-orm/decorators/legacy"; import { t as types } from "@mikro-orm/core";',
    property:
      "@Column({ type: types.text }) name?: string; @Choice({ items: () => Role }) role?: Role;",
  },
  {
    name: "new Property and t imports",
    imports: 'import { Entity } from "@mikro-orm/decorators/legacy";',
    property: "name!: string;",
  },
  {
    name: "Enum from the legacy entry point",
    imports: 'import { Entity } from "@mikro-orm/decorators/legacy";',
    property: "role!: Role;",
  },
  {
    name: "Opt used without an import",
    imports:
      'import { Entity, Property } from "@mikro-orm/decorators/legacy";\nimport { t } from "@mikro-orm/core";',
    property: "@Property({ type: t.text }) name!: Opt<string>;",
  },
  {
    name: "old core Entity and Property imports",
    imports: 'import { Entity, Property } from "@mikro-orm/core";',
    property: "name!: string;",
  },
  {
    name: "old core Entity and Enum imports",
    imports: 'import { Entity, Enum } from "@mikro-orm/core";',
    property: "role!: Role;",
  },
  {
    name: "mixed core imports with aliases, comments and trailing commas",
    imports: `import { t, Entity, /* preserve this comment */ Property, type Opt, Enum as OrmEnum, } from '@mikro-orm/core';`,
    property: 'name: Opt<string> = "hello";',
  },
  {
    name: "old Property with an existing legacy import",
    imports:
      'import { Property, t } from "@mikro-orm/core";\nimport { Entity } from "@mikro-orm/decorators/legacy";',
    property: "name!: string;",
  },
  {
    name: "mixed type-only imports from core",
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy";\nimport type { Property, Opt } from "@mikro-orm/core";',
    property: "name!: string;",
  },
  {
    name: "inline type-only imports from core",
    imports: 'import { Entity, type Property, t } from "@mikro-orm/core";',
    property: "name!: string;",
  },
  {
    name: "already aligned decorators from core",
    imports: 'import { Entity, Property, t } from "@mikro-orm/core";',
    property: "@Property({ type: t.text }) name!: string;",
  },
  {
    name: "related decorators and core option types",
    imports: `import { Entity, PrimaryKey, ManyToOne, BeforeCreate, type PropertyOptions, t } from "@mikro-orm/core";`,
    property:
      "@PrimaryKey({ type: t.integer }) id!: number; @ManyToOne(() => Thing) parent!: Thing; @BeforeCreate() beforeCreate() {} name!: string;",
  },
  {
    name: "quoted import names",
    imports:
      'import { Entity, "Property" as Property } from "@mikro-orm/core";',
    property: "name!: string;",
  },
  {
    name: "existing aliases",
    imports: `import { Entity, Property as MikroProperty } from "@mikro-orm/decorators/legacy";
import { t as ormTypes } from "@mikro-orm/core";`,
    property: "name!: string;",
  },
  {
    name: "type-only core imports",
    imports: `import { Entity } from "@mikro-orm/decorators/legacy";
import type { t, Opt } from "@mikro-orm/core";`,
    property: "name!: string;",
  },
  {
    name: "type-only decorators",
    imports: `import { Entity } from "@mikro-orm/decorators/legacy";
import type { Property } from "@mikro-orm/decorators/legacy";`,
    property: "name!: string;",
  },
  {
    name: "inline type-only decorators",
    imports:
      'import { Entity, type Property } from "@mikro-orm/decorators/legacy";',
    property: "name!: string;",
  },
  {
    name: "namespace imports",
    imports: `import { Entity } from "@mikro-orm/decorators/legacy";
import * as orm from "@mikro-orm/core";`,
    property: "name!: string;",
  },
  {
    name: "side-effect imports",
    imports: `import { Entity } from "@mikro-orm/decorators/legacy";
import "@mikro-orm/core";`,
    property: "name!: string;",
  },
];

it.each(cases)("compiles and stabilizes $name", ({ imports, property }) => {
  const code = `${imports}
enum Role { Member = "member", Admin = "admin" }
@Entity()
class Thing { ${property} }`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.fixed).toBe(true);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
  if (imports.includes("SecureColumn")) {
    expect(result.output).toContain("@SecureColumn({ type: t.string })");
    expect(result.output).not.toContain("@Property(");
  }
  const fixed = ts.createSourceFile(
    filename,
    result.output,
    ts.ScriptTarget.ES2023,
    true,
  );
  for (const statement of fixed.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      if (["t", "Opt"].includes((binding.propertyName ?? binding.name).text)) {
        expect(statement.moduleSpecifier.text).toBe("@mikro-orm/core");
      }
    }
  }
  if (imports.includes("keep driver comment"))
    expect(result.output).toContain("/* keep driver comment */");
  if (imports.includes("preserve this comment")) {
    expect(result.output).toContain("/* preserve this comment */");
    expect(result.output).toContain("Enum as OrmEnum");
    expect(result.output).toContain("type Opt");
  }
});

it("does not interpret a shadowed decorator alias as an ORM entity", () => {
  const code = `import { Entity as Model } from "@mikro-orm/decorators/legacy";
function define(Model: () => ClassDecorator) {
  @Model() class Thing { name!: string; }
  return Thing;
}`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.fixed).toBe(false);
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it("retains aliased column types when another scope shadows the alias", () => {
  const code = `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { t as types } from "@mikro-orm/core";
function shadow(types: number) {}
@Entity() class Thing { @Property({ type: types.uuid }) id?: string; }`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("type: types.uuid");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it("resolves namespace decorators and retains namespace column options", () => {
  const code = `import * as entities from "@mikro-orm/decorators/legacy";
import * as orm from "@mikro-orm/core";
@entities.Entity() class Thing {
  @entities.Property({ type: orm.t.uuid }) id?: string;
  @entities.ManyToOne(() => Thing) parent!: Thing;
}`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.fixed).toBe(true);
  expect(result.output).toContain("type: t.uuid");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it("avoids capturing a shadowed runtime helper", () => {
  const code = `import { Entity } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
function makeEntity(t: number) {
  @Entity() class Thing { name!: string; }
  return Thing;
}`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  {
    name: "runtime alias beside a type-only canonical import",
    code: 'import { Entity, Property as Column } from "@mikro-orm/decorators/legacy"; import type { Property } from "@mikro-orm/decorators/legacy"; import { t as types } from "@mikro-orm/core"; import type { t } from "@mikro-orm/core"; @Entity() class Thing { @Column({ type: types.string }) name!: string; }',
  },
  {
    name: "unrelated nested bindings",
    code: 'import { Entity, Property } from "@mikro-orm/decorators/legacy"; import { t } from "@mikro-orm/core"; @Entity() class Thing { @Property({ type: t.string }) name!: string; method(t: string, Property: string) { return t + Property; } }',
  },
  {
    name: "relative custom decorator import",
    code: 'import { Entity } from "@mikro-orm/decorators/legacy"; import { t } from "@mikro-orm/core"; import { EncryptedProperty as Secret } from "../mikro-orm-crypt/dist/index.js"; @Entity() class Thing { @Secret({ type: t.string }) name!: string; }',
  },
])("preserves $name", ({ code }) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toBe(code);
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it.each([
  {
    name: "barrel property decorator",
    code: 'import { Entity } from "@mikro-orm/decorators/legacy"; import { Property as Column, t } from "./.cache/orm-imports/orm-barrel.js"; @Entity() class Thing { @Column({ type: t.string }) name!: string; }',
    unchanged: true,
  },
  {
    name: "barrel model decorator alias",
    code: 'import { Entity as Model } from "./.cache/orm-imports/orm-barrel.js"; @Model() class Thing { name!: string; }',
    unchanged: false,
  },
  {
    name: "barrel helper retains UUID",
    code: 'import { Entity, Property } from "@mikro-orm/decorators/legacy"; import { t as types } from "./.cache/orm-imports/orm-barrel.js"; @Entity() class Thing { @Property({ type: types.uuid }) name?: string; }',
    unchanged: false,
  },
  {
    name: "barrel optional type wrapper",
    code: 'import { Entity, Property } from "@mikro-orm/decorators/legacy"; import { t, type Opt as Optional } from "./.cache/orm-imports/orm-barrel.js"; @Entity() class Thing { @Property({ type: t.string }) name: Optional<string> = "hello"; }',
    unchanged: true,
  },
])("recognizes $name", ({ code, unchanged }) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.fixed).toBe(!unchanged);
  if (unchanged) expect(result.output).toBe(code);
  if (code.includes(".uuid")) expect(result.output).toContain(".uuid");
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it("preserves a default binding when migrating its named decorators", () => {
  const code = 'import orm, { Entity } from "@mikro-orm/core";';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain('import orm, {  } from "@mikro-orm/core";');
  expect(result.output).toContain(
    'import { Entity } from "@mikro-orm/decorators/legacy";',
  );
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

const sourceFiles = new Map<string, ts.SourceFile>();
let previousProgram: ts.Program | undefined;

function compileDiagnostics(code: string): string[] {
  const options: ts.CompilerOptions = {
    noEmit: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
    types: [],
    paths: {
      "@nest-boot/mikro-orm-crypt": [
        path.resolve(packageRoot, "../mikro-orm-crypt/dist/index.d.ts"),
      ],
    },
  };
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

it.each(["EncryptedProperty", "HashedProperty"])(
  "promotes the actual type-only barrel %s binding",
  (name) => {
    const code = `import { Entity } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
import type { ${name} as Secret } from "./.cache/orm-imports/orm-barrel.js";
@Entity() class Thing { @Secret({ type: t.string }) name!: string; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.messages).toEqual([]);
    expect(result.output).toContain("@Secret(");
    expect(compileDiagnostics(result.output)).toEqual([]);
    expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
      false,
    );
  },
);

it("ignores another library's aliased model decorator", () => {
  const code =
    'import { Entity as Model } from "./.cache/orm-imports/other-decorators.js"; @Model() class Thing { name!: string; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.output).toBe(code);
  expect(result.messages).toEqual([]);
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it("retains an unrelated namespace decorator on an ORM property", () => {
  const code =
    'import { Entity } from "@mikro-orm/decorators/legacy"; import * as validation from "./.cache/orm-imports/other-decorators.js"; @Entity() class Thing { @validation.Property() name!: string; }';
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.output).toContain("@validation.Property()");
  expect(result.output).toContain("@Property(");
  expect(result.messages).toEqual([]);
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  'import * as orm from "@mikro-orm/core"; @orm.Entity() class Thing { @orm.Property({ type: orm.t.string }) name!: string; }',
  'import * as orm from "@mikro-orm/core"; @orm.Entity() class Thing { name!: string; }',
  'import type * as orm from "@mikro-orm/core"; @orm.Entity() class Thing { @orm.Property({ type: orm.t.string }) name!: string; }',
  'import * as orm from "@mikro-orm/postgresql"; @orm.Entity() class Thing { @orm.Property({ type: orm.t.string }) name!: string; }',
  'import * as orm from "@mikro-orm/core"; const ormDecorators = 1; function other(orm: { Entity(): ClassDecorator }) { @orm.Entity() class Other {} } @orm.Entity() class Thing { @orm.Property({ type: orm.t.string }) name!: string; }',
])("migrates obsolete namespace decorators: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@mikro-orm/decorators/legacy");
  if (code.includes("class Other"))
    expect(result.output).toContain("@orm.Entity() class Other");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  'import { Model, Column, types } from "./.cache/orm-imports/orm-renamed-barrel.js"; @Model() class Thing { @Column({ type: types.uuid }) id!: string; }',
  'import { Entity as Model } from "./.cache/orm-imports/orm-mixed-barrel.js"; @Model() class Thing { name!: string; }',
])("preserves the identity of chained and shadowed re-exports: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.output).toBe(code);
  expect(result.messages).toEqual([]);
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it.each([
  'import { type Model, type Secret } from "./.cache/orm-imports/orm-renamed-barrel.js"; import { t } from "@mikro-orm/core"; @Model() class Thing { @Secret({ type: t.string }) name!: string; }',
  'import type * as orm from "./.cache/orm-imports/orm-barrel.js"; @orm.Entity() class Thing { @orm.EncryptedProperty({ type: orm.t.string }) name!: string; }',
  'import { Entity } from "@mikro-orm/decorators/legacy"; import { EncryptedProperty as Runtime, type EncryptedProperty as Secret, t } from "./.cache/orm-imports/orm-barrel.js"; @Entity() class Thing { @Secret({ type: t.string }) name!: string; }',
])("promotes actual runtime references across barrel forms: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it.each([
  ["mikro-orm-crypt", "EncryptedProperty"],
  ["mikro-orm-hash", "HashedProperty"],
])(
  "preserves %s decorators imported from workspace source",
  (packageName, decorator) => {
    const code = `import { Entity } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
import { ${decorator} as Secret } from "../${packageName}/src/index.js";
@Entity() class Thing { @Secret({ type: t.string }) name!: string; }`;
    const result = linter.verifyAndFix(code, config, { filename });
    expect(result.output).toBe(code);
    expect(result.messages).toEqual([]);
    expect(compileDiagnostics(result.output)).toEqual([]);
  },
);

it.each([
  'import type * as orm from "@mikro-orm/core"; const { Entity, Property } = orm; @Entity() class Thing { @Property() name!: string; }',
  'import * as orm from "@mikro-orm/core"; const { ["Entity"]: Model, t }: { Entity: () => ClassDecorator; t: typeof orm.t } = orm; @Model() class Thing { name!: string; }',
  'import * as orm from "@mikro-orm/core"; const { Entity, t }: { Entity: () => ClassDecorator; t: typeof orm.t } = orm; @Entity() class Thing { name!: string; }',
  'import * as orm from "@mikro-orm/core"; const { Entity, Property } = orm; @Entity() class Thing { @Property() name!: string; }',
  'import * as orm from "@mikro-orm/core"; const { Entity: Model, Property: Column, t: types } = orm; @Model() class Thing { @Column({ type: types.string }) name!: string; score!: number; }',
  'import * as orm from "@mikro-orm/postgresql"; const { Entity, t, ...driver } = orm; @Entity() class Thing { name!: string; } const Driver = driver.PostgreSqlDriver;',
  'import type * as orm from "@mikro-orm/core"; const { Entity, Property, t } = orm; @Entity() class Thing { @Property({ type: t.string }) name!: string; }',
  'import * as orm from "@mikro-orm/core"; function make() { const { Entity: Model, Property = () => (() => undefined), t } = orm; @Model() class Thing { @Property({ type: t.string }) name!: string; } return Thing; }',
  'import * as orm from "@mikro-orm/core"; const { "Entity": Model, t } = orm, other = 1; function shadow(orm: { Entity(): ClassDecorator }) { const { Entity } = orm; @Entity() class Other {} } @Model() class Thing { name!: string; }',
])("migrates destructured namespace decorators: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@mikro-orm/decorators/legacy");
  expect(result.output).toContain("@Property");
  expect(compileDiagnostics(result.output)).toEqual([]);
  if (code.includes("class Other"))
    expect(result.output).toContain(
      "const { Entity } = orm; @Entity() class Other",
    );
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});

it("does not recognize namespace decorators overridden by computed properties", () => {
  const code = `import * as orm from "@mikro-orm/decorators/legacy";
const key: string = "Entity";
const { Entity }: Record<string, () => ClassDecorator> = { Entity: orm.Entity, [key]: () => (() => undefined) };
@Entity() class Thing { name!: string; }`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toBe(code);
  expect(compileDiagnostics(result.output)).toEqual([]);
});

it("recognizes const-destructured ORM exports from a project barrel", () => {
  const code = `import * as orm from "./.cache/orm-imports/orm-barrel.js";
const { Entity: Model, EncryptedProperty: Secret, t } = orm;
@Model() class Thing { @Secret({ type: t.string }) name!: string; score!: number; }`;
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toContain("@Secret({ type: t.string })");
  expect(result.output).toContain("@Property({ type: t2.float })");
  expect(compileDiagnostics(result.output)).toEqual([]);
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
});
