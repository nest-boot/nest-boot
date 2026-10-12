import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = join(packageDirectory, "bin/nb");
let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "nest-boot-cli-"));
  mkdirSync(join(project, "node_modules/@nest-boot"), { recursive: true });
  symlinkSync(
    packageDirectory,
    join(project, "node_modules/@nest-boot/command"),
    "dir",
  );
  symlinkSync(
    join(packageDirectory, "node_modules/@nestjs"),
    join(project, "node_modules/@nestjs"),
    "dir",
  );
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ type: "module" }),
  );
});
afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

/**
 *
 * @param path - File relative to the fixture project.
 * @param content - File contents.
 */
function write(path: string, content: string) {
  mkdirSync(dirname(join(project, path)), { recursive: true });
  writeFileSync(join(project, path), content);
}
/**
 *
 * @param args - CLI arguments.
 * @param production - Prefer built output.
 * @returns The child process result.
 */
function run(args: string[] = [], production = false) {
  return spawnSync(process.execPath, [executable, ...args], {
    cwd: project,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      NODE_ENV: production ? "production" : "development",
    },
  });
}

const source = `
import { CommandFactory, CommandModule } from '@nest-boot/command';
import { Module } from '@nestjs/common';
import { FeatureModule } from './commands.js';
@Module({ imports: [CommandModule, FeatureModule] })
class AppModule {}
async function bootstrap() {
  await new Promise(resolve => setTimeout(resolve, 10));
  await CommandFactory.run(AppModule);
}
void bootstrap();
`;
const commands = `
import { BaseCommand, Command, Option } from '@nest-boot/command';
import { Injectable, Module } from '@nestjs/common';
@Injectable()
class GreetingService {
  prefix = 'SOURCE';
  onApplicationShutdown() { console.log('CLOSED'); }
}
@Command({ paths: [['hello']] })
class HelloCommand extends BaseCommand {
  name = Option.String({ required: true });
  loud = Option.Boolean('--loud', false);
  constructor(private readonly service: GreetingService) { super(); }
  async execute() {
    const { punctuation } = await import('./punctuation.js');
    const name = this.loud ? this.name.toUpperCase() : this.name;
    this.context.stdout.write(this.service.prefix + ':' + name + punctuation + '\\n');
  }
}
@Module({ providers: [GreetingService, HelloCommand] })
export class FeatureModule {}
`;
/**
 *
 */
function writeSource() {
  write("src/cli.ts", source);
  write("src/commands.ts", commands);
  write("src/punctuation.ts", `export const punctuation: string = '!';`);
}
const built = `
import { BaseCommand, Command, CommandFactory, CommandModule } from '@nest-boot/command';
import { Module } from '@nestjs/common';
class BuiltCommand extends BaseCommand { async execute() { this.context.stdout.write('BUILT'); } }
Command({ paths: [['built']] })(BuiltCommand);
class AppModule {}
Module({ imports: [CommandModule], providers: [BuiltCommand] })(AppModule);
void CommandFactory.run(AppModule);
`;

it("loads source decorators and implicit DI metadata, resolves .js imports and keeps hooks through execution", () => {
  writeSource();
  const result = run(["hello", "Alice", "--loud"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:ALICE!");
  expect(result.stdout).toContain("CLOSED");
});
it("transpiles TSX dependencies with project JSX settings and resolves their TypeScript imports", () => {
  writeSource();
  write("src/commands.ts", commands.replace("./punctuation.js", "./view.js"));
  write(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "render" } }),
  );
  write(
    "src/view.tsx",
    `
    import { text } from './template-text.js';
    function render(_tag: string, _props: unknown, ...children: string[]) { return children.join(''); }
    export const punctuation = <span>{text}</span>;
  `,
  );
  write("src/template-text.ts", "export const text: string = '!';");
  write("src/template-text.js", "export const text = 'STALE';");
  const result = run(["hello", "Alice"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:Alice!");
  expect(result.stdout).not.toContain("STALE");
});
it("prefers relative TypeScript sources over adjacent JavaScript during source execution", () => {
  writeSource();
  write("src/commands.js", "throw new Error('Loaded stale commands.js');");
  write("src/punctuation.js", "export const punctuation = 'STALE';");
  const result = run(["hello", "Alice"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:Alice!");
  expect(result.stdout).not.toContain("STALE");
});
it("loads JavaScript implementations when relative declarations exist without TypeScript source", () => {
  write(
    "src/cli.ts",
    "import { message } from './message.js'; console.log(message);",
  );
  write("src/message.d.ts", "export declare const message: string;");
  write("src/message.js", "export const message = 'JAVASCRIPT';");
  const result = run();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("JAVASCRIPT");
});
it.each([false, true])(
  "resolves baseUrl-only imports with an installed package present: %s",
  (installed) => {
    writeSource();
    write("src/cli.ts", source.replace("./commands.js", "src/commands.js"));
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: { baseUrl: ".", ignoreDeprecations: "6.0" },
      }),
    );
    if (installed) {
      write(
        "node_modules/src/package.json",
        JSON.stringify({
          type: "module",
          exports: { "./commands.js": "./commands.js" },
        }),
      );
      write(
        "node_modules/src/commands.js",
        "export const FeatureModule = null; throw new Error('Loaded installed src package');",
      );
    }
    const result = run(["hello", "Alice"]);
    expect(result.stderr).toBe("");
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toContain("SOURCE:Alice!");
  },
);
it("supports tsconfig path aliases", () => {
  writeSource();
  write("src/cli.ts", source.replace("./commands.js", "@app/commands"));
  write(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { paths: { "@app/*": ["./src/*"] } } }),
  );
  const result = run(["hello", "Alice"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:Alice!");
});
it("prefers tsconfig path aliases over an installed package with the same name", () => {
  writeSource();
  write("src/cli.ts", source.replace("./commands.js", "@app/commands"));
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { paths: { "@app/*": ["./src/*"] } },
    }),
  );
  write(
    "node_modules/@app/commands/package.json",
    JSON.stringify({
      type: "module",
      exports: "./index.js",
    }),
  );
  write(
    "node_modules/@app/commands/index.js",
    "throw new Error('Loaded installed package instead of alias');",
  );
  const result = run(["hello", "Alice"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:Alice!");
});
it("prefers source during development and built JavaScript during production", () => {
  writeSource();
  write("dist/cli.js", built);
  expect(run(["hello", "Alice"]).stdout).toContain("SOURCE:Alice!");
  const result = run(["built"], true);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("BUILT");
});
it("loads compiled JavaScript without source or a tsconfig", () => {
  write("dist/cli.js", built);
  expect(run(["built"]).status).toBe(0);
});
it("supports a CommonJS bootstrap entry", () => {
  write("package.json", JSON.stringify({ type: "commonjs" }));
  write(
    "dist/cli.js",
    built
      .replace(
        "import { BaseCommand, Command, CommandFactory, CommandModule } from '@nest-boot/command';",
        "const { BaseCommand, Command, CommandFactory, CommandModule } = require('@nest-boot/command');",
      )
      .replace(
        "import { Module } from '@nestjs/common';",
        "const { Module } = require('@nestjs/common');",
      ),
  );
  const result = run(["built"]);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("BUILT");
});
it("returns a nonzero exit code for missing entries", () => {
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("CLI entry not found");
});
it("executes an entry script without exports and preserves its exit code", () => {
  write("src/cli.ts", "console.log(process.argv[1]); process.exitCode = 7;");
  const result = run();
  expect(result.status).toBe(7);
  expect(result.stdout.trim()).toBe(join(project, "src/cli.ts"));
});
it("runs the built entry directly like main.js and repl.js", () => {
  write("dist/cli.js", built);
  const result = spawnSync(process.execPath, ["dist/cli.js", "built"], {
    cwd: project,
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("BUILT");
  const failure = spawnSync(process.execPath, ["dist/cli.js", "missing"], {
    cwd: project,
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(failure.status).toBe(1);
});
it("does not fall back to stale output if a source entry fails", () => {
  write("src/cli.ts", "throw new Error('broken source');");
  write("dist/cli.js", built);
  const result = run(["built"]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("broken source");
  expect(result.stdout).not.toContain("BUILT");
});
it("returns failure for unknown commands without forcing process.exit", () => {
  write("dist/cli.js", built);
  expect(run(["missing"]).status).toBe(1);
});

it("links nb during a fresh workspace installation before compiled output exists", () => {
  const manifest = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  ) as {
    version: string;
    type: string;
    bin: Record<string, string>;
  };
  write("workspace/package.json", JSON.stringify({ private: true }));
  write("workspace/pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  write(
    "workspace/packages/command/package.json",
    JSON.stringify({
      name: "@fixture/command",
      version: manifest.version,
      type: manifest.type,
      bin: manifest.bin,
    }),
  );
  const binDirectory = join(packageDirectory, "bin");
  if (existsSync(binDirectory))
    for (const name of readdirSync(binDirectory)) {
      write(
        `workspace/packages/command/bin/${name}`,
        readFileSync(join(binDirectory, name), "utf8"),
      );
    }
  write(
    "workspace/packages/app/package.json",
    JSON.stringify({
      name: "fixture-app",
      private: true,
      dependencies: { "@fixture/command": "workspace:*" },
    }),
  );
  const installed = spawnSync(
    "pnpm",
    ["install", "--offline", "--ignore-scripts"],
    {
      cwd: join(project, "workspace"),
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  expect(installed.status, installed.stdout + installed.stderr).toBe(0);
  expect(
    existsSync(join(project, "workspace/packages/app/node_modules/.bin/nb")),
  ).toBe(true);
  write(
    "workspace/packages/command/dist/cli.js",
    "console.log('WORKSPACE CLI');\n",
  );
  const result = spawnSync("pnpm", ["exec", "nb"], {
    cwd: join(project, "workspace/packages/app"),
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("WORKSPACE CLI");
}, 20_000);
