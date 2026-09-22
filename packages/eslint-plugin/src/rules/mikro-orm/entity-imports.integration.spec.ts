import path from "node:path";
import { fileURLToPath } from "node:url";

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import rule from "./entity-property-config-from-types.js";

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
      test: { rules: { entity: rule as unknown as Rule.RuleModule } },
    },
    rules: { "test/entity": "error" },
  },
];

const cases = [
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
  if (imports.includes("preserve this comment")) {
    expect(result.output).toContain("/* preserve this comment */");
    expect(result.output).toContain("Enum as OrmEnum");
    expect(result.output).toContain("type Opt");
  }
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

function compileDiagnostics(code: string): string[] {
  const options: ts.CompilerOptions = {
    noEmit: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) =>
    file === filename
      ? ts.createSourceFile(file, code, ts.ScriptTarget.ES2023, true)
      : getSourceFile(file, ...args);
  const program = ts.createProgram([filename], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}
