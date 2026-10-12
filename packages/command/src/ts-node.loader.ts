import { create, createEsmHooks, type RegisterOptions } from "ts-node";

let hooks: Extract<ReturnType<typeof createEsmHooks>, { load: unknown }>;

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
  const created = createEsmHooks(service);
  if (!("load" in created))
    throw new Error("ts-node requires modern Node ESM hooks.");
  hooks = created;
}

/**
 * Delegates module resolution to ts-node.
 * @param args - Node's resolve hook arguments.
 * @returns The resolved module URL.
 */
export function resolve(...args: Parameters<typeof hooks.resolve>) {
  const [specifier, context, nextResolve] = args;
  if (
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("file:")
  ) {
    // Keep modern package exports on Node's resolver, rather than ts-node's fork.
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
    if (error instanceof Error) throw new Error(error.message);
    throw error;
  }
}
