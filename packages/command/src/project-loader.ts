import { existsSync, readFileSync, statSync } from "node:fs";
import { type ModuleHooks, registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Resolves a CLI entry relative to the application working directory.
 * @param cwd - Application directory.
 * @param production - Prefer compiled output when true.
 * @returns The first existing entry file.
 */
export function resolveCliEntry(cwd: string, production: boolean): string {
  const source = ["src/cli.ts"];
  const built = ["dist/cli.js"];
  const candidates = production ? [...built, ...source] : [...source, ...built];
  for (const candidate of candidates) {
    const path = resolve(cwd, candidate);
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  throw new Error(
    `CLI entry not found in ${cwd}. Expected ${candidates.join(", ")}.`,
  );
}

/**
 * Installs TypeScript hooks preserving Nest decorator metadata and .js imports.
 * @param entry - TypeScript entry file used to locate the project tsconfig.
 * @returns Hooks kept active while the entry's bootstrap and dynamic imports run.
 */
export async function registerTypeScript(entry: string): Promise<ModuleHooks> {
  const ts = await import("typescript");
  const configPath = ts.findConfigFile(dirname(entry), (path) =>
    ts.sys.fileExists(path),
  );
  let options: import("typescript").CompilerOptions = {};
  if (configPath) {
    const config = ts.readConfigFile(configPath, (path) =>
      ts.sys.readFile(path),
    );
    if (config.error)
      throw new Error(
        ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
      );
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      dirname(configPath),
    );
    // Transpilation does not require the config's include patterns to match files.
    const errors = parsed.errors.filter((error) => error.code !== 18003);
    if (errors.length)
      throw new Error(
        errors
          .map((error) =>
            ts.flattenDiagnosticMessageText(error.messageText, "\n"),
          )
          .join("\n"),
      );
    options = parsed.options;
  }
  const compilerOptions: import("typescript").CompilerOptions = {
    ...options,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: options.target ?? ts.ScriptTarget.ES2023,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    composite: false,
    incremental: false,
    declaration: false,
    declarationMap: false,
    noEmit: false,
    emitDeclarationOnly: false,
    sourceMap: false,
    inlineSourceMap: true,
    inlineSources: true,
  };
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      // TypeScript paths take precedence over packages with the same name.
      if (
        configPath &&
        options.paths &&
        !specifier.startsWith(".") &&
        !specifier.startsWith("/") &&
        context.parentURL?.startsWith("file:") &&
        /\.(?:ts|mts)$/.test(new URL(context.parentURL).pathname)
      ) {
        const resolved = ts.resolveModuleName(
          specifier,
          fileURLToPath(context.parentURL),
          options,
          ts.sys,
        ).resolvedModule;
        if (resolved && !resolved.isExternalLibraryImport) {
          return nextResolve(
            pathToFileURL(resolved.resolvedFileName).href,
            context,
          );
        }
      }
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND" ||
          !context.parentURL?.startsWith("file:") ||
          !/\.(?:ts|mts)$/.test(new URL(context.parentURL).pathname)
        )
          throw error;
        if (specifier.startsWith(".") || specifier.startsWith("/")) {
          const url = new URL(specifier, context.parentURL);
          const filename = fileURLToPath(url);
          const alternatives = filename.endsWith(".js")
            ? [filename.slice(0, -3) + ".ts"]
            : [filename + ".ts", join(filename, "index.ts")];
          for (const alternative of alternatives) {
            if (existsSync(alternative) && statSync(alternative).isFile()) {
              return nextResolve(pathToFileURL(alternative).href, context);
            }
          }
        }
        throw error;
      }
    },
    load(url, context, nextLoad) {
      if (
        !url.startsWith("file:") ||
        !/\.(?:ts|mts)$/.test(new URL(url).pathname)
      ) {
        return nextLoad(url, context);
      }
      const filename = fileURLToPath(url);
      const result = ts.transpileModule(readFileSync(filename, "utf8"), {
        fileName: filename,
        compilerOptions,
        reportDiagnostics: true,
      });
      const errors = result.diagnostics?.filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      );
      if (errors?.length)
        throw new Error(
          errors
            .map((error) =>
              ts.flattenDiagnosticMessageText(error.messageText, "\n"),
            )
            .join("\n"),
        );
      return {
        format: "module",
        source: result.outputText,
        shortCircuit: true,
      };
    },
  });
}
