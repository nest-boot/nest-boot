import { spawnSync } from "node:child_process";
import {
  cpSync,
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
const testApplication = join(packageDirectory, "src/test");
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
    join(packageDirectory, "node_modules/@nest-boot/request-context"),
    join(project, "node_modules/@nest-boot/request-context"),
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

const sourceConfig = JSON.parse(
  readFileSync(join(testApplication, "tsconfig.json"), "utf8"),
) as { compilerOptions: Record<string, string | boolean>; include: string[] };
const commands = readFileSync(
  join(testApplication, "src/app/hello.command.ts"),
  "utf8",
);

/** Copies the complete Nest application into the isolated test project. */
function writeSource() {
  cpSync(join(testApplication, "src"), join(project, "src"), {
    recursive: true,
  });
  write(
    "tsconfig.json",
    readFileSync(join(testApplication, "tsconfig.json"), "utf8"),
  );
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

it("uses ts-node for source decorators, implicit DI metadata, relative imports and dynamic imports", () => {
  writeSource();
  const result = run(["hello", "Alice", "--loud"]);
  expect(result.stderr).not.toMatch(/Error|SyntaxError|TSError/);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:ALICE!");
  expect(result.stdout).toContain("CLOSED");
});
it("runs a Nest source application without a tsconfig using default decorator settings", () => {
  writeSource();
  rmSync(join(project, "tsconfig.json"));
  const result = run(["hello", "Alice", "--loud"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("SOURCE:ALICE!");
  expect(result.stdout).toContain("CLOSED");
});
it("runs a TypeScript 6 project whose source tsconfig does not declare rootDir", () => {
  writeSource();
  const compilerOptions = { ...sourceConfig.compilerOptions };
  delete compilerOptions.rootDir;
  write("tsconfig.json", JSON.stringify({ ...sourceConfig, compilerOptions }));
  const result = run(["hello", "Alice", "--loud"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("SOURCE:ALICE!");
  expect(result.stdout).toContain("CLOSED");
});
it("transpiles TSX dependencies with project JSX settings and resolves their TypeScript imports", () => {
  writeSource();
  write(
    "src/app/hello.command.ts",
    commands.replace("./punctuation.js", "./view.js"),
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      ...sourceConfig,
      compilerOptions: {
        ...sourceConfig.compilerOptions,
        jsx: "react",
        jsxFactory: "render",
      },
    }),
  );
  write(
    "src/app/view.tsx",
    `
    import { text } from './template-text.js';
    function render(_tag: string, _props: unknown, ...children: string[]) { return children.join(''); }
    export const punctuation = <span>{text}</span>;
  `,
  );
  write("src/app/template-text.ts", "export const text: string = '!';");
  write("src/app/template-text.js", "export const text = 'STALE';");
  const result = run(["hello", "Alice"]);
  expect(result.stderr).not.toMatch(/Error|SyntaxError|TSError/);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("SOURCE:Alice!");
  expect(result.stdout).not.toContain("STALE");
});
it("prefers relative TypeScript sources over adjacent JavaScript during source execution", () => {
  writeSource();
  write(
    "src/app/app.module.js",
    "throw new Error('Loaded stale app.module.js');",
  );
  write("src/app/punctuation.js", "export const punctuation = 'STALE';");
  const result = run(["hello", "Alice"]);
  expect(result.stderr).not.toMatch(/Error|SyntaxError|TSError/);
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
  expect(result.stderr).not.toMatch(/Error|SyntaxError|TSError/);
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("JAVASCRIPT");
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
it("uses Node's package exports resolution for bare imports", () => {
  write("tsconfig.json", JSON.stringify(sourceConfig));
  write(
    "src/cli.ts",
    "import { value } from 'fixture-package/worker.js'; console.log(value);",
  );
  write(
    "node_modules/fixture-package/package.json",
    JSON.stringify({
      type: "module",
      exports: { "./*.js": "./*.js", "./*": "./*.js" },
    }),
  );
  write(
    "node_modules/fixture-package/worker.js",
    "export const value = 'PACKAGE EXPORTS';",
  );
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("PACKAGE EXPORTS");
});
it("loads a CommonJS JavaScript dependency from an ESM source entry", () => {
  write("tsconfig.json", JSON.stringify(sourceConfig));
  write(
    "src/cli.ts",
    "import worker from './worker.cjs'; console.log(worker.value);",
  );
  write("src/worker.cjs", "module.exports = { value: 'COMMONJS DEPENDENCY' };");
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("COMMONJS DEPENDENCY");
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
  expect(result.stderr).not.toMatch(/Error|SyntaxError|TSError/);
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
