import { fileURLToPath } from "node:url";

import { create, createEsmHooks, type RegisterOptions } from "ts-node";

let hooks: Extract<ReturnType<typeof createEsmHooks>, { load: unknown }>;
let ignored: ReturnType<typeof create>["ignored"];

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
  const sourceParent =
    context.parentURL?.startsWith("file:") &&
    !ignored(fileURLToPath(context.parentURL));
  const sourceTarget =
    specifier.startsWith("file:") && !ignored(fileURLToPath(specifier));
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
