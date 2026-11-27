import { AsyncLocalStorage } from "node:async_hooks";

import type { Agent as MastraAgent } from "@mastra/core/agent";
import { MASTRA_TOOL_MARKER, Tool as MastraTool } from "@mastra/core/tools";
import { CAN_METADATA, EXTERNAL_HANDLER_INSTANCE } from "@nest-boot/auth";
import {
  type CanActivate,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  ApplicationConfig,
  ExternalContextCreator,
  ModulesContainer,
} from "@nestjs/core";
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper.js";
import type { Module as NestModuleRef } from "@nestjs/core/injector/module.js";
import { isObservable, lastValueFrom } from "rxjs";

import { type AnyMastraTool, BaseTool } from "./base.tool.js";

/** NestJS `ExecutionContext.getType()` value used when executing a Mastra tool. */
export const MASTRA_TOOL_EXECUTION_CONTEXT_TYPE = "mastra:tool:execution";

/** NestJS `ExecutionContext.getType()` value used when filtering exposed Mastra tools. */
export const MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE = "mastra:tool:discovery";

const GUARDS_METADATA = "__guards__";
const ROUTE_ARGS_METADATA = "__routeArguments__";

const MASTRA_TOOL_OWN_KEYS = new Set([
  "id",
  "title",
  "description",
  "inputSchema",
  "outputSchema",
  "suspendSchema",
  "resumeSchema",
  "requestContextSchema",
  "execute",
  "renderOnly",
  "mastra",
  "requireApproval",
  "needsApprovalFn",
  "beforeApproval",
  "strict",
  "outputValidation",
  "providerOptions",
  "toModelOutput",
  "transform",
  "mcp",
  "onInputStart",
  "onInputDelta",
  "onInputAvailable",
  "onOutput",
  "inputExamples",
  "mcpMetadata",
  "background",
]);

interface PreflightApprovalState {
  approvedTool?: object;
  targetToolId?: string;
}

const preflightApprovalStorage =
  new AsyncLocalStorage<PreflightApprovalState>();
const activeToolDelegatesStorage = new AsyncLocalStorage<
  WeakMap<object, (inputData: unknown, context: unknown) => Promise<unknown>>
>();

export const GET_TOOL_ORIGINAL_EXECUTE = Symbol(
  "nest-mastra-get-tool-original-execute",
);
export const SET_TOOL_EXECUTE_DELEGATE = Symbol(
  "nest-mastra-set-tool-execute-delegate",
);
export const CAN_EXPOSE_TOOL = Symbol("nest-mastra-can-expose-tool");
export const ASSERT_CAN_EXPOSE_TOOL = Symbol(
  "nest-mastra-assert-can-expose-tool",
);
const TOOL_BOUND_CREATOR = Symbol("nest-mastra-tool-bound-creator");
const RESET_TOOL_GUARDS = Symbol("nest-mastra-reset-tool-guards");
const AGENT_BOUND_CREATOR = Symbol("nest-mastra-agent-bound-creator");
const AGENT_TOOL_BINDER_REF = Symbol("nest-mastra-agent-tool-binder-ref");
const WRAPPED_AGENT_LIST_TOOLS = Symbol("nest-mastra-wrapped-agent-list-tools");
const WRAPPED_AGENT_FORK = Symbol("nest-mastra-wrapped-agent-fork");

interface AgentBinderRef {
  current?: (tool: AnyMastraTool) => void;
}

export interface GuardableToolInternal {
  [GET_TOOL_ORIGINAL_EXECUTE]?: () => (...args: unknown[]) => unknown;
  [SET_TOOL_EXECUTE_DELEGATE]?: (
    fn: (...args: unknown[]) => Promise<unknown>,
  ) => void;
  [CAN_EXPOSE_TOOL]?: () => Promise<boolean>;
  [ASSERT_CAN_EXPOSE_TOOL]?: () => Promise<void>;
  [TOOL_BOUND_CREATOR]?: ExternalContextCreator;
  [RESET_TOOL_GUARDS]?: () => void;
}

interface GuardWrappedAgentInternal {
  [AGENT_BOUND_CREATOR]?: ExternalContextCreator;
  [AGENT_TOOL_BINDER_REF]?: AgentBinderRef;
  __fork?: (() => MastraAgent) & { [WRAPPED_AGENT_FORK]?: true };
}

interface GuardsContextCreatorLike {
  create(
    instance: object,
    callback: (...args: unknown[]) => unknown,
    moduleKey: string,
    contextId?: unknown,
    inquirerId?: string,
  ): CanActivate[];
}

interface ExternalContextCreatorInternal {
  guardsContextCreator?: GuardsContextCreatorLike;
  modulesContainer?: ModulesContainer;
  getHostModuleKey?: (
    instance: object,
    classRef: unknown,
    inquirerId?: string,
  ) => string;
}

export interface BindToolGuardsOptions {
  wrapper?: InstanceWrapper;
  moduleRef?: NestModuleRef;
  applicationConfig?: ApplicationConfig;
}

export interface WrapAgentToolDiscoveryOptions {
  bindUnboundTool?: (tool: AnyMastraTool) => void;
  externalContextCreator?: ExternalContextCreator;
}

/**
 * Checks whether an arbitrary value is a Mastra `Tool` instance.
 * @param value - Candidate object
 * @returns True when the value is a Mastra `Tool`
 */
export function isMastraToolInstance(value: unknown): value is AnyMastraTool {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return value instanceof MastraTool || MASTRA_TOOL_MARKER in value;
}

/**
 * Checks whether an un-registered tool instance is a `BaseTool` or custom `Tool` subclass
 * (excluding plain `createTool(...)` / built-in functional tools).
 * @param value - Candidate tool value
 * @returns True when the tool is a class-based `BaseTool` or `Tool` subclass instance
 */
export function isClassBasedMastraTool(value: unknown): value is AnyMastraTool {
  if (!isMastraToolInstance(value)) {
    return false;
  }
  return value instanceof BaseTool || value.constructor !== MastraTool;
}

/**
 * Checks whether an error thrown by a NestJS guard represents an HTTP 401 or 403 denial.
 * @param error - Thrown error value
 * @returns True when the error is a 401 Unauthorized or 403 Forbidden HTTP exception
 */
function isAuthorizationDenialError(error: unknown): boolean {
  if (
    error instanceof UnauthorizedException ||
    error instanceof ForbiddenException
  ) {
    return true;
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return status === 401 || status === 403;
  }
  return false;
}

/**
 * Resolves the prototype/original `execute` handler used for decorator reflection and invocation.
 * @param tool - Target Mastra tool instance
 * @returns Original `execute` function, or a fallback no-op for render-only tools
 */
function resolveToolMetadataHandler(
  tool: AnyMastraTool & GuardableToolInternal,
): (...args: unknown[]) => unknown {
  const baseOriginal = tool[GET_TOOL_ORIGINAL_EXECUTE]?.();
  if (typeof baseOriginal === "function") {
    return baseOriginal;
  }

  const proto = Object.getPrototypeOf(tool) as {
    execute?: (...args: unknown[]) => unknown;
  } | null;
  if (typeof proto?.execute === "function") {
    return proto.execute;
  }

  if (typeof tool.execute === "function") {
    return tool.execute as (...args: unknown[]) => unknown;
  }

  return () => undefined;
}

/**
 * Verifies that any class-referenced `@UseGuards(...)` enhancers, scoped global guards,
 * and input-dependent `@Can(...)` callbacks on a tool can run safely, failing closed
 * at startup instead of silently skipping guards or inspecting unvalidated input.
 * @param tool - Target Mastra tool instance
 * @param handler - Reflected `execute` method handler
 * @param options - Optional NestJS provider wrapper and module context
 */
function assertToolGuardsCanRun(
  tool: AnyMastraTool,
  handler: (...args: unknown[]) => unknown,
  options?: BindToolGuardsOptions,
): void {
  const classConstructor = tool.constructor;

  if (!(tool instanceof BaseTool)) {
    const classCanMeta =
      (Reflect.getMetadata(CAN_METADATA, classConstructor) as
        | { subjectCallback?: unknown }[]
        | undefined) ?? [];
    const methodCanMeta =
      (Reflect.getMetadata(CAN_METADATA, handler) as
        | { subjectCallback?: unknown }[]
        | undefined) ?? [];
    const hasSubjectCallback = [...classCanMeta, ...methodCanMeta].some(
      (entry) => typeof entry?.subjectCallback === "function",
    );
    const hasParamDecorators = Boolean(
      Reflect.getMetadata(ROUTE_ARGS_METADATA, classConstructor, "execute"),
    );
    if (hasSubjectCallback || hasParamDecorators) {
      throw new Error(
        `Mastra tool "${classConstructor.name}" declares input-dependent authorization metadata on a raw Mastra Tool. ` +
          `Extend "BaseTool(...)" instead so guards evaluate Mastra's schema-validated input.`,
      );
    }
  }

  const classGuards =
    (Reflect.getMetadata(GUARDS_METADATA, classConstructor) as
      | unknown[]
      | undefined) ?? [];
  const methodGuards =
    (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined) ??
    [];

  const unresolvedClassGuards = [...classGuards, ...methodGuards].filter(
    (guard): guard is abstract new (...args: never[]) => unknown => {
      if (typeof guard !== "function") {
        return false;
      }
      if (
        typeof (guard as { canActivate?: unknown }).canActivate === "function"
      ) {
        return false;
      }
      // `@nest-boot/mastra` requires `@nestjs/core` ^12.6.0 (`peerDependencies`),
      // where `Scanner` registers `@UseGuards(...)` class enhancers onto `moduleRef.injectables`
      // for both class providers and `{ provide: TOKEN, useClass }` providers.
      const enhancerWrapper = options?.moduleRef?.injectables.get(guard);
      if (!enhancerWrapper) {
        return true;
      }
      const isBoundToWrapper =
        options?.wrapper?.getEnhancersMetadata()?.includes(enhancerWrapper) ??
        false;
      return !(
        isBoundToWrapper ||
        (enhancerWrapper.isDependencyTreeStatic() &&
          !enhancerWrapper.isTransient)
      );
    },
  );

  if (unresolvedClassGuards.length > 0) {
    const names = [
      ...new Set(unresolvedClassGuards.map((guard) => `"${guard.name}"`)),
    ];
    const providerLabel = String(
      options?.wrapper?.name ?? classConstructor.name,
    );
    throw new Error(
      `Mastra tool "${classConstructor.name}" (${providerLabel}) references guard ${names.join(", ")} by class, ` +
        `but NestJS did not register ${names.length > 1 ? "them" : "it"} for this provider. ` +
        `Register "${classConstructor.name}" in module providers as a class (or with "useClass"), or pass guard instances to "@UseGuards(...)".`,
    );
  }

  const scopedGlobalGuards =
    options?.applicationConfig?.getGlobalRequestGuards() ?? [];
  if (
    scopedGlobalGuards.length > 0 &&
    (!options?.moduleRef ||
      !options.wrapper ||
      !options.moduleRef.entryProviders.includes(options.wrapper))
  ) {
    const firstScoped = scopedGlobalGuards[0];
    const guardName = String(
      firstScoped?.metatype?.name ?? firstScoped?.name ?? "APP_GUARD",
    );
    throw new Error(
      `Mastra tool "${classConstructor.name}" cannot run request- or transient-scoped global guard "${guardName}" because tools are singleton providers.`,
    );
  }
}

/**
 * Verifies that preconfigured Mastra tools and agents are not already bound to another
 * active NestJS container before `new Mastra(...)` mutates shared agent references.
 * @param primitives - Preconfigured tools and agents passed to `MastraModule`
 * @param primitives.tools - Optional preconfigured tools map
 * @param primitives.agents - Optional preconfigured agents map
 */
export function assertMastraPrimitivesAvailable(primitives: {
  tools?: Record<string, unknown>;
  agents?: Record<string, unknown>;
}): void {
  for (const candidate of Object.values(primitives.tools ?? {})) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const internalTool = candidate as AnyMastraTool & GuardableToolInternal;
    if (internalTool[TOOL_BOUND_CREATOR]) {
      throw new Error(
        `Mastra tool "${String(internalTool.id)}" (${internalTool.constructor.name}) is already bound to another active NestJS container. ` +
          `Instantiate a separate tool per application or close the previous application before reusing the instance.`,
      );
    }
  }

  for (const candidate of Object.values(primitives.agents ?? {})) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const internalAgent = candidate as MastraAgent & GuardWrappedAgentInternal;
    if (internalAgent[AGENT_BOUND_CREATOR]) {
      throw new Error(
        `Mastra agent "${internalAgent.id}" (${internalAgent.constructor.name}) is already bound to another active NestJS container. ` +
          `Instantiate a separate agent per application or close the previous application before reusing the instance.`,
      );
    }
  }
}

/**
 * Marks any non-Mastra own string properties on a class-based tool instance
 * (such as TypeScript constructor-injected NestJS services) as non-enumerable
 * so Mastra's `{ ...tool }` serializers never copy credentials or circular DI graphs.
 * @param tool - Target Mastra tool instance
 */
export function concealToolInstanceDependencies(tool: AnyMastraTool): void {
  if (!isClassBasedMastraTool(tool)) {
    return;
  }

  for (const key of Object.getOwnPropertyNames(tool)) {
    if (MASTRA_TOOL_OWN_KEYS.has(key)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(tool, key);
    if (descriptor?.enumerable && descriptor.configurable !== false) {
      Object.defineProperty(tool, key, {
        ...descriptor,
        enumerable: false,
      });
    }
  }
}

/**
 * Returns the invocation-scoped execution delegate for an already-admitted `BaseTool.execute` call,
 * preserving execution guards even if `unbindToolGuards` runs while discovery is awaiting.
 * @param tool - Target `BaseTool` instance
 * @returns Active invocation delegate or `undefined`
 */
export function getActiveToolExecuteDelegate(
  tool: object,
): ((inputData: unknown, context: unknown) => Promise<unknown>) | undefined {
  return activeToolDelegatesStorage.getStore()?.get(tool);
}

/**
 * Runs a callback with `delegateFn` pinned in `AsyncLocalStorage` for `tool`.
 * @param tool - Target `BaseTool` instance
 * @param delegateFn - Guarded execution delegate for the owning container
 * @param fn - Async callback invoking Mastra's validated `execute`
 * @returns Result of `fn`
 */
async function runWithActiveToolExecuteDelegate<T>(
  tool: object,
  delegateFn: (inputData: unknown, context: unknown) => Promise<unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = activeToolDelegatesStorage.getStore();
  if (existing) {
    const previous = existing.get(tool);
    existing.set(tool, delegateFn);
    try {
      return await fn();
    } finally {
      if (previous) {
        existing.set(tool, previous);
      } else {
        existing.delete(tool);
      }
    }
  }

  const map = new WeakMap<
    object,
    (inputData: unknown, context: unknown) => Promise<unknown>
  >();
  map.set(tool, delegateFn);
  return await activeToolDelegatesStorage.run(map, fn);
}

/**
 * Runs an HTTP tool execution callback inside an `AsyncLocalStorage` preflight scope so
 * the single target tool whose discovery guard already succeeded in the same HTTP execution
 * request (via controller preflight or `agent.listTools()`) is not charged twice.
 * @param target - Target tool instance and/or requested tool ID for this HTTP execution
 * @param target.tool - Optional tool instance already preflight-approved by the controller
 * @param target.targetToolId - Optional requested tool ID from the route path parameter
 * @param fn - Async callback that dispatches tool execution
 * @returns Result of `fn`
 */
export async function runWithPreflightApprovedTool<T>(
  target: { tool?: object; targetToolId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const state: PreflightApprovalState = {
    approvedTool: target.tool,
    targetToolId: target.targetToolId,
  };
  return await preflightApprovalStorage.run(state, fn);
}

/**
 * Consumes a one-shot preflight approval token for `tool` in the current async context.
 * @param tool - Target tool instance
 * @returns True when `tool` was preflight-approved for this call
 */
function consumePreflightApprovedTool(tool: object): boolean {
  const state = preflightApprovalStorage.getStore();
  if (state?.approvedTool === tool) {
    state.approvedTool = undefined;
    return true;
  }
  return false;
}

/**
 * Attaches the bound handler instance to an `ExecutionContext` argument array via
 * `@nest-boot/auth`'s non-enumerable symbol so dynamic `@Can` callbacks resolve `self`
 * directly without requiring `moduleRef.resolve(context.getClass())`.
 * @param args - Execution context argument array
 * @param instance - Bound Mastra tool instance
 * @returns Same `args` array with `EXTERNAL_HANDLER_INSTANCE` defined
 */
function attachHandlerInstance(args: unknown[], instance: object): unknown[] {
  Object.defineProperty(args, EXTERNAL_HANDLER_INSTANCE, {
    value: instance,
    enumerable: false,
  });
  return args;
}

/**
 * Binds NestJS `ExternalContextCreator` execution guards (`"mastra:tool:execution"`) and
 * exposure-time discovery guards (`"mastra:tool:discovery"`) onto a Mastra tool instance.
 * @param tool - Target Mastra tool instance
 * @param externalContextCreator - NestJS external context creator
 * @param options - Optional NestJS provider wrapper, host module, and application config
 */
export function bindToolGuards(
  tool: AnyMastraTool,
  externalContextCreator: ExternalContextCreator,
  options?: BindToolGuardsOptions,
): void {
  concealToolInstanceDependencies(tool);

  const internalTool = tool as AnyMastraTool & GuardableToolInternal;
  if (internalTool[TOOL_BOUND_CREATOR]) {
    if (internalTool[TOOL_BOUND_CREATOR] === externalContextCreator) {
      return;
    }
    throw new Error(
      `Mastra tool "${String(tool.id)}" (${tool.constructor.name}) is already bound to another active NestJS container. ` +
        `Instantiate a separate tool per application or close the previous application before reusing the instance.`,
    );
  }

  const handler = resolveToolMetadataHandler(internalTool);
  assertToolGuardsCanRun(tool, handler, options);

  const originalOuterExecute = tool.execute;

  let discoveryGuardFn: ((args: unknown[]) => Promise<void>) | null | undefined;
  const assertCanExpose = async (): Promise<void> => {
    if (discoveryGuardFn === undefined) {
      discoveryGuardFn = getDiscoveryOrExecutionGuardFn(
        tool,
        handler,
        externalContextCreator,
        options,
        MASTRA_TOOL_DISCOVERY_CONTEXT_TYPE,
      );
    }

    if (discoveryGuardFn) {
      await discoveryGuardFn(attachHandlerInstance([], tool));
    }
  };

  const canExpose = async (): Promise<boolean> => {
    try {
      await assertCanExpose();
      return true;
    } catch (error) {
      if (isAuthorizationDenialError(error)) {
        return false;
      }
      throw error;
    }
  };

  let executionGuardFn: ((args: unknown[]) => Promise<void>) | null | undefined;
  const runExecutionGuards = async (args: unknown[]): Promise<void> => {
    if (executionGuardFn === undefined) {
      executionGuardFn = getDiscoveryOrExecutionGuardFn(
        tool,
        handler,
        externalContextCreator,
        options,
        MASTRA_TOOL_EXECUTION_CONTEXT_TYPE,
      );
    }
    if (executionGuardFn) {
      await executionGuardFn(attachHandlerInstance(args, tool));
    }
  };

  if (typeof internalTool[SET_TOOL_EXECUTE_DELEGATE] === "function") {
    const setDelegate = internalTool[SET_TOOL_EXECUTE_DELEGATE];
    const guardedDelegate = async (inputData: unknown, context: unknown) => {
      await runExecutionGuards([inputData, context]);
      const output = await handler.call(tool, inputData, context);
      return isObservable(output) ? await lastValueFrom(output) : output;
    };
    setDelegate(guardedDelegate);

    if (typeof originalOuterExecute === "function") {
      const boundValidatedExecute = originalOuterExecute.bind(tool) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      tool.execute = (async (...args: unknown[]) => {
        // Enforce exposure/static guards ahead of Mastra schema validation so
        // unauthorized callers receive 401/403 instead of field validation details,
        // unless an HTTP preflight already verified exposure for this invocation.
        if (!consumePreflightApprovedTool(tool)) {
          await assertCanExpose();
        }
        return await runWithActiveToolExecuteDelegate(
          tool,
          guardedDelegate,
          () => boundValidatedExecute(...args),
        );
      }) as typeof tool.execute;
    }
  } else if (typeof originalOuterExecute === "function") {
    const rawExecute = originalOuterExecute.bind(tool) as (
      ...args: unknown[]
    ) => Promise<unknown>;

    tool.execute = (async (...args: unknown[]) => {
      if (!consumePreflightApprovedTool(tool)) {
        await assertCanExpose();
      }
      // Native Mastra Tool parses input internally after `tool.execute` begins;
      // input-dependent @Can callbacks are rejected at startup, so withhold raw
      // input (`args[0]`) while still forwarding the execution context (`args[1]`).
      await runExecutionGuards([undefined, args[1]]);
      return await rawExecute(...args);
    }) as typeof tool.execute;
  }

  const resetGuards = (): void => {
    if (typeof internalTool[SET_TOOL_EXECUTE_DELEGATE] === "function") {
      internalTool[SET_TOOL_EXECUTE_DELEGATE]((inputData, context) =>
        Promise.resolve(handler.call(tool, inputData, context)),
      );
    }
    tool.execute = originalOuterExecute;
    Reflect.deleteProperty(internalTool, CAN_EXPOSE_TOOL);
    Reflect.deleteProperty(internalTool, ASSERT_CAN_EXPOSE_TOOL);
    Reflect.deleteProperty(internalTool, TOOL_BOUND_CREATOR);
    Reflect.deleteProperty(internalTool, RESET_TOOL_GUARDS);
  };

  Object.defineProperty(internalTool, CAN_EXPOSE_TOOL, {
    value: canExpose,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  Object.defineProperty(internalTool, ASSERT_CAN_EXPOSE_TOOL, {
    value: assertCanExpose,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  Object.defineProperty(internalTool, TOOL_BOUND_CREATOR, {
    value: externalContextCreator,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  Object.defineProperty(internalTool, RESET_TOOL_GUARDS, {
    value: resetGuards,
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

/**
 * Releases NestJS container guard bindings on a tool when its owning application shuts down,
 * allowing preconfigured tool instances to be cleanly reused in subsequent applications.
 * @param tool - Target Mastra tool instance
 * @param externalContextCreator - Owning container's external context creator
 */
export function unbindToolGuards(
  tool: AnyMastraTool,
  externalContextCreator?: ExternalContextCreator,
): void {
  const internalTool = tool as AnyMastraTool & GuardableToolInternal;
  if (
    externalContextCreator &&
    internalTool[TOOL_BOUND_CREATOR] === externalContextCreator
  ) {
    internalTool[RESET_TOOL_GUARDS]?.();
  }
}

/**
 * Resolves the compiled NestJS guard activation function for a tool using its authoritative
 * host module and provider inquirer ID across both discovery and execution phases.
 *
 * Intentionally follows NestJS `ExternalContextCreator` semantics (identical to `@nestjs/graphql`):
 * global `APP_GUARD` enhancers run with `context.getType()` set to `"mastra:tool:discovery"` or
 * `"mastra:tool:execution"` and tool arguments in `context.getArgs()`, which `@nest-boot/auth`'s
 * `AuthGuard` evaluates against `RequestContext`. Guards requiring HTTP transport objects must
 * branch on `context.getType()`.
 * @param tool - Target Mastra tool instance
 * @param handler - Reflected `execute` method handler
 * @param externalContextCreator - NestJS external context creator
 * @param options - Optional NestJS provider wrapper and module context
 * @param contextType - Execution context type (`"mastra:tool:execution"` or `"mastra:tool:discovery"`)
 * @returns Async guard activation function, or `null` when no guards apply
 */
function getDiscoveryOrExecutionGuardFn(
  tool: AnyMastraTool,
  handler: (...args: unknown[]) => unknown,
  externalContextCreator: ExternalContextCreator,
  options: BindToolGuardsOptions | undefined,
  contextType: string,
): ((args: unknown[]) => Promise<void>) | null {
  const internalCreator =
    externalContextCreator as unknown as ExternalContextCreatorInternal;
  const guardsContextCreator = internalCreator.guardsContextCreator;
  if (!guardsContextCreator) {
    return null;
  }

  const hostModuleKey = internalCreator.getHostModuleKey?.(
    tool,
    tool.constructor,
    options?.wrapper?.id,
  );
  const moduleKey =
    options?.moduleRef?.token ??
    (hostModuleKey && hostModuleKey.length > 0 ? hostModuleKey : undefined) ??
    externalContextCreator.getContextModuleKey(tool.constructor);
  const inquirerId =
    options?.wrapper?.id ??
    internalCreator.modulesContainer
      ?.get(moduleKey)
      ?.entryProviders.find(
        (item) => item.token === tool.constructor || item.instance === tool,
      )?.id;
  const guards = guardsContextCreator.create(
    tool,
    handler,
    moduleKey,
    undefined,
    inquirerId,
  );
  const fnCanActivate = externalContextCreator.createGuardsFn(
    guards,
    tool,
    handler,
    contextType,
  );

  return fnCanActivate as ((args: unknown[]) => Promise<void>) | null;
}

/**
 * Evaluates whether a tool may be exposed in the current server-side authorization context.
 * Tools not bound to NestJS guards always resolve to `true`.
 * @param tool - Candidate tool object
 * @returns `true` when the tool is visible to the current caller
 */
export async function canExposeMastraTool(tool: unknown): Promise<boolean> {
  if (typeof tool !== "object" || tool === null) {
    return true;
  }
  const internalTool = tool as GuardableToolInternal;
  if (typeof internalTool[CAN_EXPOSE_TOOL] !== "function") {
    return true;
  }
  const allowed = await internalTool[CAN_EXPOSE_TOOL]();
  const preflightState = preflightApprovalStorage.getStore();
  if (
    allowed &&
    preflightState &&
    !preflightState.approvedTool &&
    preflightState.targetToolId !== undefined &&
    (tool as { id?: unknown }).id === preflightState.targetToolId
  ) {
    preflightState.approvedTool = tool;
  }
  return allowed;
}

/**
 * Throws the underlying 401/403 authorization exception when a tool fails exposure-time guards.
 * @param tool - Candidate tool object
 */
export async function assertCanExposeMastraTool(tool: unknown): Promise<void> {
  if (typeof tool !== "object" || tool === null) {
    return;
  }
  const internalTool = tool as GuardableToolInternal;
  if (typeof internalTool[ASSERT_CAN_EXPOSE_TOOL] === "function") {
    await internalTool[ASSERT_CAN_EXPOSE_TOOL]();
    return;
  }
  if (typeof internalTool[CAN_EXPOSE_TOOL] === "function") {
    const allowed = await internalTool[CAN_EXPOSE_TOOL]();
    if (!allowed) {
      throw new ForbiddenException("Forbidden resource");
    }
  }
}

export interface FilterAccessibleToolsOptions {
  /** Internal callback used by `MastraManager` to bind ad-hoc `BaseTool` instances lazily. */
  bindUnboundTool?: (tool: AnyMastraTool) => void;
}

/**
 * Filters a Mastra tools record to only the tools accessible in the current authorization context.
 * Returns `Partial<TTools>` because unauthorized tool keys are omitted from the returned map.
 * @param tools - Record of Mastra tools keyed by tool name
 * @param options - Optional lazy binder options
 * @returns Partial tools record containing only authorized entries
 */
export async function filterAccessibleTools<
  TTools extends Record<string, unknown>,
>(
  tools: TTools,
  options?: FilterAccessibleToolsOptions,
): Promise<Partial<TTools>> {
  const entries = Object.entries(tools);
  if (entries.length === 0) {
    return {};
  }

  const decisions = await Promise.all(
    entries.map(async ([key, tool]) => {
      if (options?.bindUnboundTool && isClassBasedMastraTool(tool)) {
        options.bindUnboundTool(tool);
      }
      const allowed = await canExposeMastraTool(tool);
      return [key, tool, allowed] as const;
    }),
  );

  const filtered: Record<string, unknown> = {};
  for (const [key, tool, allowed] of decisions) {
    if (allowed) {
      filtered[key] = tool;
    }
  }
  return filtered as Partial<TTools>;
}

/**
 * Wraps an `Agent` instance's `listTools` (and internal `__fork` clone hook) so unauthorized
 * tools are automatically hidden before schemas are sent to models or Mastra APIs.
 * Reapplies wrapping if a subclass replaced `listTools` with a class field after `super()`,
 * shares a revocable binder reference with `__fork()` clones, and prevents a second active
 * NestJS container from hijacking an already-bound agent's binder.
 * @param agent - Target Mastra agent instance
 * @param binderOrOptions - Optional lazy tool binder or container binding options
 */
export function wrapAgentToolDiscovery(
  agent: MastraAgent,
  binderOrOptions?:
    | ((tool: AnyMastraTool) => void)
    | WrapAgentToolDiscoveryOptions,
): void {
  const internalAgent = agent as MastraAgent & GuardWrappedAgentInternal;
  const normalizedOptions: WrapAgentToolDiscoveryOptions =
    typeof binderOrOptions === "function"
      ? { bindUnboundTool: binderOrOptions }
      : (binderOrOptions ?? {});

  if (normalizedOptions.externalContextCreator) {
    const existingCreator = internalAgent[AGENT_BOUND_CREATOR];
    if (
      existingCreator &&
      existingCreator !== normalizedOptions.externalContextCreator
    ) {
      throw new Error(
        `Mastra agent "${agent.id}" (${agent.constructor.name}) is already bound to another active NestJS container. ` +
          `Instantiate a separate agent per application or close the previous application before reusing the instance.`,
      );
    }
    Object.defineProperty(internalAgent, AGENT_BOUND_CREATOR, {
      value: normalizedOptions.externalContextCreator,
      configurable: true,
      enumerable: false,
      writable: false,
    });
    const containerBinderRef = internalAgent[AGENT_TOOL_BINDER_REF] ?? {};
    containerBinderRef.current = normalizedOptions.bindUnboundTool;
    Object.defineProperty(internalAgent, AGENT_TOOL_BINDER_REF, {
      value: containerBinderRef,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } else if (normalizedOptions.bindUnboundTool) {
    const binderRef = internalAgent[AGENT_TOOL_BINDER_REF] ?? {};
    binderRef.current = normalizedOptions.bindUnboundTool;
    Object.defineProperty(internalAgent, AGENT_TOOL_BINDER_REF, {
      value: binderRef,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }

  const currentListTools = Reflect.get(agent, "listTools") as
    | (typeof agent.listTools & { [WRAPPED_AGENT_LIST_TOOLS]?: true })
    | undefined;
  if (
    typeof currentListTools === "function" &&
    !currentListTools[WRAPPED_AGENT_LIST_TOOLS]
  ) {
    const originalListTools = currentListTools.bind(agent);
    const wrappedListTools = (async (
      params?: Parameters<MastraAgent["listTools"]>[0],
    ) => {
      const resolvedTools = await originalListTools(params);
      return await filterAccessibleTools(resolvedTools, {
        bindUnboundTool: internalAgent[AGENT_TOOL_BINDER_REF]?.current,
      });
    }) as typeof agent.listTools & { [WRAPPED_AGENT_LIST_TOOLS]?: true };

    Object.defineProperty(wrappedListTools, WRAPPED_AGENT_LIST_TOOLS, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    agent.listTools = wrappedListTools;
  }

  if (
    typeof internalAgent.__fork === "function" &&
    !internalAgent.__fork[WRAPPED_AGENT_FORK]
  ) {
    const originalFork = internalAgent.__fork.bind(internalAgent);
    const wrappedFork = (() => {
      const forked = originalFork() as MastraAgent & GuardWrappedAgentInternal;
      wrapAgentToolDiscovery(forked);
      const parentBinderRef = internalAgent[AGENT_TOOL_BINDER_REF];
      if (parentBinderRef) {
        Object.defineProperty(forked, AGENT_TOOL_BINDER_REF, {
          value: parentBinderRef,
          configurable: true,
          enumerable: false,
          writable: true,
        });
      }
      return forked;
    }) as (() => MastraAgent) & { [WRAPPED_AGENT_FORK]?: true };

    Object.defineProperty(wrappedFork, WRAPPED_AGENT_FORK, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    internalAgent.__fork = wrappedFork;
  }
}

/**
 * Releases NestJS container binder ownership on an agent (and invalidates any
 * cloned forks sharing its binder reference) when its owning application shuts
 * down or rolls back a failed initialization.
 * @param agent - Target Mastra agent instance
 * @param externalContextCreator - Owning container's external context creator
 */
export function unbindAgentToolDiscovery(
  agent: MastraAgent,
  externalContextCreator?: ExternalContextCreator,
): void {
  const internalAgent = agent as MastraAgent & GuardWrappedAgentInternal;
  if (
    externalContextCreator &&
    internalAgent[AGENT_BOUND_CREATOR] === externalContextCreator
  ) {
    if (internalAgent[AGENT_TOOL_BINDER_REF]) {
      internalAgent[AGENT_TOOL_BINDER_REF].current = undefined;
    }
    Reflect.deleteProperty(internalAgent, AGENT_BOUND_CREATOR);
    Reflect.deleteProperty(internalAgent, AGENT_TOOL_BINDER_REF);
  }
}
