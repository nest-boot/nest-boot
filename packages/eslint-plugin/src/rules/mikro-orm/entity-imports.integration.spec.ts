import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import rule from "./entity-property-config-from-types.js";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
// Keep executable compiler fixtures isolated from the workspace packages.
const fixtureRoot = path.join(packageRoot, ".cache/orm-imports");
mkdirSync(fixtureRoot, { recursive: true });
afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});
writeFileSync(
  path.join(fixtureRoot, "orm-barrel.ts"),
  `export { EncryptedProperty } from "../../../database-crypt/dist/index.js";
export { HashedProperty } from "../../../database-hash/dist/index.js";
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
  {
    name: "custom property decorator binding remains unchanged",
    imports:
      'import { Entity } from "@mikro-orm/decorators/legacy"; import { EncryptedProperty as SecureColumn } from "@nest-boot/database-crypt";',
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
  if (imports.includes('"@mikro-orm/postgresql"')) {
    expect(result.output).toContain('from "@mikro-orm/postgresql"');
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
    code: 'import { Entity } from "@mikro-orm/decorators/legacy"; import { t } from "@mikro-orm/core"; import { EncryptedProperty as Secret } from "../database-crypt/dist/index.js"; @Entity() class Thing { @Secret({ type: t.string }) name!: string; }',
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
  if (unchanged) {
    expect(result.output).toBe(code);
  }
  if (code.includes(".uuid")) {
    expect(result.output).toContain(".uuid");
  }
  expect(linter.verifyAndFix(result.output, config, { filename }).fixed).toBe(
    false,
  );
  expect(compileDiagnostics(result.output)).toEqual([]);
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
      "@nest-boot/database-crypt": [
        path.resolve(packageRoot, "../database-crypt/dist/index.d.ts"),
      ],
    },
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) => {
    if (file === filename) {
      return ts.createSourceFile(file, code, ts.ScriptTarget.ES2023, true);
    }
    const cached = sourceFiles.get(file);
    if (cached) {
      return cached;
    }
    const source = getSourceFile(file, ...args);
    if (source) {
      sourceFiles.set(file, source);
    }
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
  ["database-crypt", "EncryptedProperty"],
  ["database-hash", "HashedProperty"],
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

it.each([
  'export * from "@mikro-orm/core"; export * from "@mikro-orm/decorators/legacy";',
  'export type * from "@mikro-orm/core"; export type * from "@mikro-orm/decorators/legacy";',
  'export * as orm from "@mikro-orm/core";',
])("preserves existing wildcard and namespace APIs: %s", (code) => {
  const result = linter.verifyAndFix(code, config, { filename });
  expect(result.messages).toEqual([]);
  expect(result.output).toBe(code);
  expect(compileDiagnostics(result.output)).toEqual([]);
});
