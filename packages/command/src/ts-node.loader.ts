import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { create, createEsmHooks, type RegisterOptions } from "ts-node";
import ts from "typescript";

let hooks: Extract<ReturnType<typeof createEsmHooks>, { load: unknown }>;
let ignored: ReturnType<typeof create>["ignored"];
let compilerOptions: ts.CompilerOptions = {};

/**
 * Checks whether an import specifier matches any configured TypeScript `paths` pattern.
 * @param specifier - Module specifier from the importing source file.
 * @param paths - Parsed `compilerOptions.paths` table.
 * @returns `true` when at least one pattern matches the specifier.
 */
function matchesPathsPattern(
  specifier: string,
  paths: ts.MapLike<string[]> | undefined,
): boolean {
  if (!paths) {
    return false;
  }
  return Object.keys(paths).some((pattern) => {
    const [prefix, suffix] = pattern.split("*");
    return suffix === undefined
      ? specifier === prefix
      : specifier.length >= prefix.length + suffix.length &&
          specifier.startsWith(prefix) &&
          specifier.endsWith(suffix);
  });
}

/**
 * Resolves a non-relative `compilerOptions.paths` alias to a `file:` URL.
 * @param specifier - Module specifier written in TypeScript source.
 * @param containingFile - Absolute file path of the importing module.
 * @returns The resolved `file:` URL, or `undefined` when no local alias target matches.
 */
function resolvePathAlias(
  specifier: string,
  containingFile: string,
): string | undefined {
  if (!matchesPathsPattern(specifier, compilerOptions.paths)) {
    return undefined;
  }
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
  );
  if (!resolvedModule || resolvedModule.isExternalLibraryImport) {
    return undefined;
  }
  const { resolvedFileName } = resolvedModule;
  if (resolvedFileName.endsWith(".d.ts")) {
    const runtimePath = `${resolvedFileName.slice(0, -5)}.js`;
    return existsSync(runtimePath)
      ? pathToFileURL(runtimePath).href
      : undefined;
  }
  return pathToFileURL(resolvedFileName).href;
}

/**
 * Creates ts-node's ESM hooks in Node's loader thread.
 * @param options - The project directory and ts-node execution settings.
 */
export function initialize(options: RegisterOptions): void {
  let service = create(options);
  if (!service.config.options.configFilePath) {
    // ts-node's default moduleResolution predates TypeScript 6.
    options.compilerOptions = {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2023",
      rootDir: options.cwd,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    };
    service = create(options);
  } else if (!service.config.options.rootDir) {
    // ts-node's temporary outDir requires an explicit rootDir in TypeScript 6.
    options.compilerOptions = {
      ...options.compilerOptions,
      rootDir: options.cwd,
    };
    service = create(options);
  }
  compilerOptions = service.config.options;
  // Our minimum Node version always uses ts-node's modern ESM hook API.
  hooks = createEsmHooks(service) as typeof hooks;
  ignored = (fileName) => service.ignored(fileName);
}

/**
 * Delegates module resolution to ts-node.
 * @param args - Node's resolve hook arguments.
 * @returns The resolved module URL.
 */
export function resolve(...args: Parameters<typeof hooks.resolve>) {
  const [specifier, context, nextResolve] = args;
  const parentPath = context.parentURL?.startsWith("file:")
    ? fileURLToPath(context.parentURL)
    : undefined;
  const sourceParent = Boolean(parentPath && !ignored(parentPath));
  const sourceTarget =
    specifier.startsWith("file:") && !ignored(fileURLToPath(specifier));
  if (
    sourceParent &&
    parentPath &&
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("file:") &&
    !specifier.startsWith("node:")
  ) {
    const aliasedUrl = resolvePathAlias(specifier, parentPath);
    if (aliasedUrl) {
      return hooks.resolve(aliasedUrl, context, nextResolve);
    }
  }
  if (
    (!specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.startsWith("file:")) ||
    (!sourceParent && !sourceTarget)
  ) {
    // Node owns package exports and imports from files ts-node does not compile.
    return nextResolve(specifier, context, nextResolve);
  }
  return hooks.resolve(...args);
}

/**
 * Delegates module loading and compilation to ts-node.
 * @param args - Node's load hook arguments.
 * @returns The compiled module and its format.
 */
export async function load(...args: Parameters<typeof hooks.load>) {
  try {
    return await hooks.load(...args);
  } catch (error) {
    // TSError's custom properties do not survive Node's loader-thread transfer.
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw error;
  }
}
