import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { tmpdir } from "node:os";

import { join, resolve } from "node:path";

import ts from "typescript";

const packageRoot = resolve(import.meta.dirname, "../..");

const temporaryProjects: string[] = [];

function resolveConfig(
  preset: string,
  configName = "tsconfig.json",
): ts.ParsedCommandLine {
  const projectRoot = mkdtempSync(join(tmpdir(), "nest-boot-tsconfig-"));
  temporaryProjects.push(projectRoot);
  mkdirSync(join(projectRoot, "src"));
  mkdirSync(join(projectRoot, "test"));
  writeFileSync(
    join(projectRoot, "src", "index.ts"),
    "export const value = 1;\n",
  );
  writeFileSync(join(projectRoot, "src", "index.spec.ts"), "export {};\n");
  writeFileSync(join(projectRoot, "test", "fixture.ts"), "export {};\n");
  const configPath = join(projectRoot, configName);
  writeFileSync(
    configPath,
    JSON.stringify({
      extends: join(packageRoot, preset),
      compilerOptions: { types: [] },
    }),
  );
  return parseConfig(configPath);
}

function parseConfig(configPath: string): ts.ParsedCommandLine {
  const diagnostics: ts.Diagnostic[] = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) =>
        diagnostics.push(diagnostic),
    },
  );
  expect(diagnostics).toEqual([]);
  if (!parsed) {
    throw new Error(`Failed to resolve ${configPath}`);
  }
  return parsed;
}

function currentProjectRoot(): string {
  const projectRoot = temporaryProjects.at(-1);
  if (!projectRoot) {
    throw new Error("No temporary project was created");
  }
  return projectRoot;
}

afterEach(() => {
  for (const projectRoot of temporaryProjects.splice(0)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

describe("Nest CLI 12 ESM presets", () => {
  it("resolves application output relative to the consuming project", () => {
    const parsed = resolveConfig("app.json");
    const projectRoot = currentProjectRoot();
    expect(parsed.options.outDir).toBe(join(projectRoot, "dist"));
    expect(parsed.options.tsBuildInfoFile).toBeUndefined();
    expect(parsed.options.module).toBe(ts.ModuleKind.NodeNext);
    expect(parsed.options.moduleResolution).toBe(
      ts.ModuleResolutionKind.NodeNext,
    );
    expect(parsed.options.strict).toBe(true);
    expect(parsed.options.strictPropertyInitialization).toBe(false);
    expect(parsed.options.removeComments).toBe(true);
  });
  it("uses separate default build info for library checks and builds", () => {
    resolveConfig("library.json", "tsconfig.build.json");
    const projectRoot = currentProjectRoot();
    const checkConfig = join(projectRoot, "tsconfig.json");
    writeFileSync(
      checkConfig,
      JSON.stringify({
        extends: "./tsconfig.build.json",
        compilerOptions: { rootDir: ".", noEmit: true },
      }),
    );
    const parsed = parseConfig(checkConfig);
    const program = ts.createIncrementalProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
    });
    expect(program.emit().diagnostics).toEqual([]);
    expect(readdirSync(join(projectRoot, "dist"))).toEqual([
      "tsconfig.tsbuildinfo",
    ]);
    expect(existsSync(join(projectRoot, "tsconfig.build.tsbuildinfo"))).toBe(
      false,
    );
  });
  it("matches the generated library boundaries in the consuming project", () => {
    const parsed = resolveConfig("library.json", "tsconfig.build.json");
    const projectRoot = currentProjectRoot();
    expect(parsed.options.composite).toBe(true);
    expect(parsed.options.removeComments).toBe(false);
    expect(parsed.options.rootDir).toBe(join(projectRoot, "src"));
    expect(parsed.options.outDir).toBe(join(projectRoot, "dist"));
    expect(parsed.options.tsBuildInfoFile).toBeUndefined();
    expect(parsed.fileNames).toEqual([join(projectRoot, "src", "index.ts")]);

    const program = ts.createIncrementalProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
    });
    const emitResult = program.emit();
    expect(emitResult.diagnostics).toEqual([]);
    expect(existsSync(join(projectRoot, "tsconfig.build.tsbuildinfo"))).toBe(
      true,
    );
    expect(
      readdirSync(join(projectRoot, "dist")).filter((file) =>
        file.endsWith(".tsbuildinfo"),
      ),
    ).toEqual([]);
  });
});
