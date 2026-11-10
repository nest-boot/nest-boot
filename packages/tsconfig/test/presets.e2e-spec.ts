import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join, resolve } from "node:path";

import ts from "typescript";

const packageRoot = resolve(import.meta.dirname, "..");

const temporaryProjects: string[] = [];

function resolveConfig(name: string): ts.ParsedCommandLine {
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
  const configPath = join(projectRoot, "tsconfig.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      extends: join(packageRoot, name),
      compilerOptions: { types: [] },
    }),
  );
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
    throw new Error(`Failed to resolve ${name}`);
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
    expect(parsed.options.module).toBe(ts.ModuleKind.NodeNext);
    expect(parsed.options.moduleResolution).toBe(
      ts.ModuleResolutionKind.NodeNext,
    );
    expect(parsed.options.strict).toBe(true);
    expect(parsed.options.strictPropertyInitialization).toBe(false);
    expect(parsed.options.removeComments).toBe(true);
  });
  it("matches the generated library boundaries in the consuming project", () => {
    const parsed = resolveConfig("library.json");
    const projectRoot = currentProjectRoot();
    expect(parsed.options.composite).toBe(true);
    expect(parsed.options.removeComments).toBe(false);
    expect(parsed.options.rootDir).toBe(join(projectRoot, "src"));
    expect(parsed.options.outDir).toBe(join(projectRoot, "dist"));
    expect(parsed.fileNames).toEqual([join(projectRoot, "src", "index.ts")]);
  });
});
