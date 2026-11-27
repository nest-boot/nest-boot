import { Agent as MastraAgent } from "@mastra/core/agent";
import { MASTRA_TOOL_MARKER, Tool as MastraTool } from "@mastra/core/tools";
import { can, CAN_METADATA, getAuthAbility } from "@nest-boot/auth";
import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";

import { type AnyMastraTool, BaseTool } from "./base.tool.js";

type CanAuthorizedSubject = Parameters<typeof can>[1];

interface CanMetadataEntry {
  action: string;
  subject?: CanAuthorizedSubject;
  subjectCallback?: (
    self: unknown,
    ...args: unknown[]
  ) => CanAuthorizedSubject | Promise<CanAuthorizedSubject>;
}

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

const WRAPPED_DISCOVERY_METHOD = Symbol("nest-mastra-wrapped-discovery-method");
const WRAPPED_AGENT_FORK = Symbol("nest-mastra-wrapped-agent-fork");
const SOURCE_PRIMITIVE = Symbol("nest-mastra-source-primitive");

interface WrappedDiscoveryFunction {
  (...args: unknown[]): unknown;
  [WRAPPED_DISCOVERY_METHOD]?: true;
}

interface DiscoveryWrappedPrimitive {
  [SOURCE_PRIMITIVE]?: object;
}

/**
 * Checks whether an arbitrary value is a Mastra `Tool` instance.
 * @param value - Candidate object
 * @returns `true` when the value is a Mastra `Tool`
 */
export function isMastraToolInstance(value: unknown): value is AnyMastraTool {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return value instanceof MastraTool || MASTRA_TOOL_MARKER in value;
}

/**
 * Marks non-Mastra own string properties on a class-based tool instance
 * (such as constructor-injected NestJS services) as non-enumerable so
 * Mastra's `{ ...tool }` serializers on admin/Studio endpoints (`/api/mastra/*`,
 * gated by `@Can("manage", Mastra)`) do not copy circular DI graphs.
 * @param tool - Candidate Mastra tool object
 */
export function concealToolInstanceDependencies(tool: unknown): void {
  if (
    !isMastraToolInstance(tool) ||
    (!(tool instanceof BaseTool) && tool.constructor === MastraTool)
  ) {
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
 * Checks whether an error thrown during permission evaluation represents an HTTP 401/403 denial.
 * @param error - Thrown error value
 * @returns `true` when the error is a 401 Unauthorized or 403 Forbidden HTTP exception
 */
function isPermissionDenialError(error: unknown): boolean {
  if (
    error instanceof ForbiddenException ||
    error instanceof UnauthorizedException
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
 * Checks whether a value is Promise-like (`Thenable`).
 * @param value - Candidate return value
 * @returns `true` when `value` exposes a callable `.then`
 */
function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Collects class-level `@Can(...)` metadata entries declared on a Mastra primitive
 * (including the original subclass when evaluating a `__fork()` agent clone),
 * rejecting method-level `@Can(...)` on `Tool.execute` so execution-shaped callbacks
 * are neither silently ignored nor invoked with discovery options in place of tool input.
 * @param effectiveTarget - Unwrapped tool, sub-agent, or workflow object
 * @returns Ordered class-level `@Can` metadata requirements
 */
function getCanRequirements(effectiveTarget: object): CanMetadataEntry[] {
  const proto = Object.getPrototypeOf(effectiveTarget) as {
    constructor?: unknown;
    execute?: unknown;
  } | null;
  const ctor = proto?.constructor;

  if (isMastraToolInstance(effectiveTarget)) {
    if (
      typeof proto?.execute === "function" &&
      Reflect.getMetadata(CAN_METADATA, proto.execute)
    ) {
      const toolName =
        typeof ctor === "function" && ctor.name ? ctor.name : "AnonymousTool";
      throw new Error(
        `Mastra tool "${toolName}" declares @Can(...) on execute(). ` +
          `Decorate the tool class with @Can(...) instead, and use authorize() inside execute() for input-dependent checks.`,
      );
    }
  }

  if (typeof ctor !== "function" || ctor === Object) {
    return [];
  }

  return (
    (Reflect.getMetadata(CAN_METADATA, ctor) as
      | CanMetadataEntry[]
      | undefined) ?? []
  );
}

/**
 * Evaluates remaining `@Can(...)` requirements starting at `startIndex`, staying
 * synchronous unless a `subjectCallback` returns a Promise-like value.
 * @param effectiveTarget - Unwrapped primitive instance
 * @param requirements - Class-level `@Can` metadata list
 * @param startIndex - Index of first requirement to evaluate
 * @param options - Discovery call options
 * @returns `boolean` when synchronous, or `Promise<boolean>` when an async callback is encountered
 */
function evaluateCanRequirementsFrom(
  effectiveTarget: object,
  requirements: CanMetadataEntry[],
  startIndex: number,
  options: unknown,
): boolean | Promise<boolean> {
  for (let i = startIndex; i < requirements.length; i++) {
    const requirement = requirements[i];
    if (typeof requirement.subjectCallback === "function") {
      let maybeSubject: CanAuthorizedSubject | Promise<CanAuthorizedSubject>;
      try {
        maybeSubject = requirement.subjectCallback(
          effectiveTarget,
          options ?? {},
        );
      } catch (error) {
        if (isPermissionDenialError(error)) {
          return false;
        }
        throw error;
      }

      if (isPromiseLike<CanAuthorizedSubject>(maybeSubject)) {
        return Promise.resolve(maybeSubject).then(
          (subject) => {
            if (subject === undefined || !can(requirement.action, subject)) {
              return false;
            }
            return evaluateCanRequirementsFrom(
              effectiveTarget,
              requirements,
              i + 1,
              options,
            );
          },
          (error: unknown) => {
            if (isPermissionDenialError(error)) {
              return false;
            }
            throw error;
          },
        );
      }

      if (
        maybeSubject === undefined ||
        !can(requirement.action, maybeSubject)
      ) {
        return false;
      }
      continue;
    }

    if (
      requirement.subject === undefined ||
      !can(requirement.action, requirement.subject)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates `@Can(...)` discovery eligibility synchronously when possible, returning a
 * `Promise<boolean>` only when a dynamic `@Can` callback is asynchronous.
 * @param target - Candidate tool, sub-agent, or workflow
 * @param options - Discovery call options (e.g. `{ requestContext }`)
 * @returns `boolean` or `Promise<boolean>`
 */
function evaluateMastraPrimitiveDiscovery(
  target: unknown,
  options?: unknown,
): boolean | Promise<boolean> {
  if (typeof target !== "object" || target === null) {
    return true;
  }

  const effectiveTarget =
    (target as DiscoveryWrappedPrimitive)[SOURCE_PRIMITIVE] ?? target;
  const requirements = getCanRequirements(effectiveTarget);
  if (requirements.length === 0) {
    return true;
  }

  try {
    // Require a prepared authenticated ability before invoking any subject callback.
    getAuthAbility();
  } catch (error) {
    if (isPermissionDenialError(error)) {
      return false;
    }
    throw error;
  }

  return evaluateCanRequirementsFrom(effectiveTarget, requirements, 0, options);
}

/**
 * Evaluates whether a Mastra primitive (`Tool`, sub-`Agent`, or `Workflow`) is
 * discoverable by an `Agent` under `@Can(...)` metadata in the current `RequestContext`.
 * Primitives without `@Can(...)` metadata are unrestricted.
 * @param target - Candidate tool, sub-agent, or workflow
 * @param options - Discovery call options (e.g. `{ requestContext }`)
 * @returns `true` when the primitive has no `@Can` metadata or all `@Can` requirements pass
 */
export async function canDiscoverMastraPrimitive(
  target: unknown,
  options?: unknown,
): Promise<boolean> {
  return await evaluateMastraPrimitiveDiscovery(target, options);
}

/**
 * Populates a null-prototype dictionary with authorized `[key, value]` entries.
 * @param filtered - Target null-prototype dictionary
 * @param decisions - Evaluated `[key, value, allowed]` tuples
 * @param onAuthorizedEntry - Optional hook invoked for each authorized value
 * @returns Populated `filtered` dictionary
 */
function populateAuthorizedRecord(
  filtered: Record<string, unknown>,
  decisions: readonly (readonly [string, unknown, boolean])[],
  onAuthorizedEntry?: (value: unknown) => void,
): Record<string, unknown> {
  for (const [key, value, allowed] of decisions) {
    if (allowed) {
      onAuthorizedEntry?.(value);
      Object.defineProperty(filtered, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return filtered;
}

/**
 * Filters a record of Mastra primitives (`tools`, `agents`, or `workflows`) to only
 * entries permitted by `@Can(...)` in the current `RequestContext`, returning a
 * null-prototype dictionary synchronously when all checks are synchronous (preserving
 * `Agent.listAgents()` synchronous callers) or a `Promise` when any check is async.
 * @template TRecord - Record type returned by `listTools`, `listAgents`, or `listWorkflows`
 * @param record - Raw primitive map resolved by the agent
 * @param options - Discovery options passed to the listing method
 * @param onAuthorizedEntry - Optional hook invoked for each authorized value
 * @returns Filtered null-prototype record (or Promise thereof) containing only authorized entries
 */
function filterAuthorizedRecord<TRecord>(
  record: TRecord,
  options: unknown,
  onAuthorizedEntry?: (value: unknown) => void,
): TRecord | Promise<TRecord> {
  if (typeof record !== "object" || record === null) {
    return record;
  }

  const filtered = Object.create(null) as Record<string, unknown>;
  const entries = Object.entries(record as Record<string, unknown>);
  if (entries.length === 0) {
    return filtered as TRecord;
  }

  const decisions: (readonly [string, unknown, boolean | Promise<boolean>])[] =
    [];
  try {
    for (const [key, value] of entries) {
      decisions.push([
        key,
        value,
        evaluateMastraPrimitiveDiscovery(value, options),
      ]);
    }
  } catch (error) {
    for (const [, , allowed] of decisions) {
      if (isPromiseLike(allowed)) {
        void Promise.resolve(allowed).catch(() => undefined);
      }
    }
    throw error;
  }

  if (decisions.some(([, , allowed]) => isPromiseLike(allowed))) {
    return Promise.all(
      decisions.map(
        async ([key, value, allowed]) => [key, value, await allowed] as const,
      ),
    ).then(
      (resolved) =>
        populateAuthorizedRecord(
          filtered,
          resolved,
          onAuthorizedEntry,
        ) as TRecord,
    );
  }

  return populateAuthorizedRecord(
    filtered,
    decisions as readonly (readonly [string, unknown, boolean])[],
    onAuthorizedEntry,
  ) as TRecord;
}

/**
 * Installs an idempotent, non-configurable wrapper around an `Agent` method so
 * post-`super()` class fields or monkey-patches cannot strip `@Can(...)` filtering.
 * @param agent - Target Mastra agent instance
 * @param methodName - Property name on `MastraAgent`
 * @param buildWrapper - Factory producing the wrapped function from the original method
 */
function installLockedMethodWrapper(
  agent: MastraAgent,
  methodName: string,
  buildWrapper: (
    currentMethod: WrappedDiscoveryFunction,
  ) => WrappedDiscoveryFunction,
): void {
  const currentMethod = Reflect.get(agent, methodName) as
    | WrappedDiscoveryFunction
    | undefined;
  if (
    typeof currentMethod !== "function" ||
    currentMethod[WRAPPED_DISCOVERY_METHOD]
  ) {
    return;
  }

  const wrapped = buildWrapper(currentMethod);

  Object.defineProperty(wrapped, WRAPPED_DISCOVERY_METHOD, {
    value: true,
    enumerable: false,
  });

  Object.defineProperty(agent, methodName, {
    value: wrapped,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

/**
 * Wraps a discovery method (`listTools`, `listAgents`, or `listWorkflows`) on an
 * `Agent` instance idempotently so unauthorized `@Can(...)` entries are filtered out.
 * @param agent - Target Mastra agent instance
 * @param methodName - Discovery method name on `MastraAgent`
 * @param onAuthorizedEntry - Optional hook invoked for each authorized primitive
 */
function wrapDiscoveryMethod(
  agent: MastraAgent,
  methodName: "listTools" | "listAgents" | "listWorkflows",
  onAuthorizedEntry?: (value: unknown) => void,
): void {
  installLockedMethodWrapper(agent, methodName, (currentMethod) => {
    return function (this: MastraAgent, ...args: unknown[]) {
      const raw = currentMethod.apply(this, args);
      if (isPromiseLike(raw)) {
        return Promise.resolve(raw).then((resolved) =>
          filterAuthorizedRecord(resolved, args[0], onAuthorizedEntry),
        );
      }
      return filterAuthorizedRecord(raw, args[0], onAuthorizedEntry);
    };
  });
}

/**
 * Filters a nested `toolsets` dictionary (`{ [toolsetName]: { [toolName]: tool } }`)
 * against `@Can(...)` metadata in the active `RequestContext`.
 * @param toolsets - Candidate `toolsets` map passed to `Agent` execution or `defaultOptions`
 * @param options - Discovery options (`{ requestContext }`)
 * @returns Filtered null-prototype `toolsets` dictionary
 */
async function filterToolsetsMap(
  toolsets: Record<string, unknown>,
  options: unknown,
): Promise<Record<string, unknown>> {
  const filteredToolsets = Object.create(null) as Record<string, unknown>;
  for (const [toolsetName, toolset] of Object.entries(toolsets)) {
    Object.defineProperty(filteredToolsets, toolsetName, {
      value: await filterAuthorizedRecord(
        toolset,
        options,
        concealToolInstanceDependencies,
      ),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return filteredToolsets;
}

/**
 * Wraps an internal `Agent` execution tool-conversion method (`listToolsets` or
 * `listClientTools`) so per-call `toolsets` and `clientTools` passed into `generate()`
 * or `stream()` apply the same `@Can(...)` discovery filtering as `listTools()`.
 * @param agent - Target Mastra agent instance
 * @param methodName - Internal `Agent` method name (`"listToolsets"` or `"listClientTools"`)
 * @param fieldName - Parameter property holding the tools input (`"toolsets"` or `"clientTools"`)
 * @param filterField - Filter applied to `params[fieldName]` prior to conversion
 */
function wrapExecutionToolFieldMethod(
  agent: MastraAgent,
  methodName: "listToolsets" | "listClientTools",
  fieldName: "toolsets" | "clientTools",
  filterField: (value: Record<string, unknown>, options: unknown) => unknown,
): void {
  installLockedMethodWrapper(agent, methodName, (currentMethod) => {
    return async function (this: MastraAgent, ...args: unknown[]) {
      const params = args[0];
      if (typeof params === "object" && params !== null) {
        const record = params as Record<string, unknown>;
        const fieldValue = record[fieldName];
        if (typeof fieldValue === "object" && fieldValue !== null) {
          const filteredValue = await filterField(
            fieldValue as Record<string, unknown>,
            { requestContext: record.requestContext },
          );
          return await currentMethod.call(
            this,
            { ...record, [fieldName]: filteredValue },
            ...args.slice(1),
          );
        }
      }
      return await currentMethod.apply(this, args);
    };
  });
}

/**
 * Filters `toolsets` and `clientTools` declared inside `Agent.getDefaultOptions()`
 * (including `Agent.network()`, which reads `defaultOptions.clientTools` directly),
 * leaving `defaultOptions` without `toolsets`/`clientTools` untouched and synchronous.
 * @param defaultOptions - Raw result of `agent.getDefaultOptions(...)`
 * @param discoveryOptions - Discovery options (`{ requestContext }`)
 * @returns Unchanged `defaultOptions`, or a `Promise` resolving to a filtered copy
 */
function filterDefaultOptionsCapabilities(
  defaultOptions: unknown,
  discoveryOptions: unknown,
): unknown {
  if (typeof defaultOptions !== "object" || defaultOptions === null) {
    return defaultOptions;
  }

  const record = defaultOptions as Record<string, unknown>;
  const hasToolsets =
    typeof record.toolsets === "object" && record.toolsets !== null;
  const hasClientTools =
    typeof record.clientTools === "object" && record.clientTools !== null;
  if (!hasToolsets && !hasClientTools) {
    return defaultOptions;
  }

  return (async () => {
    const copy: Record<string, unknown> = { ...record };
    if (hasToolsets) {
      copy.toolsets = await filterToolsetsMap(
        record.toolsets as Record<string, unknown>,
        discoveryOptions,
      );
    }
    if (hasClientTools) {
      copy.clientTools = await filterAuthorizedRecord(
        record.clientTools,
        discoveryOptions,
        concealToolInstanceDependencies,
      );
    }
    return copy;
  })();
}

/**
 * Wraps an `Agent` instance's capability discovery surfaces (`listTools`, `listAgents`,
 * `listWorkflows`, per-call `listToolsets` / `listClientTools`, `getDefaultOptions`,
 * and internal `__fork()` clones) so any `@Can(...)`-restricted tools, sub-agents,
 * or workflows unauthorized in the current `RequestContext` are hidden from the agent.
 * Stateless across containers: all authorization state is read per-call from `RequestContext`.
 * @param agent - Target Mastra agent instance
 */
export function wrapAgentDiscovery(agent: MastraAgent): void {
  wrapDiscoveryMethod(agent, "listTools", concealToolInstanceDependencies);
  wrapDiscoveryMethod(agent, "listAgents", (subAgent) => {
    if (subAgent instanceof MastraAgent) {
      wrapAgentDiscovery(subAgent);
    }
  });
  wrapDiscoveryMethod(agent, "listWorkflows");
  wrapExecutionToolFieldMethod(
    agent,
    "listToolsets",
    "toolsets",
    filterToolsetsMap,
  );
  wrapExecutionToolFieldMethod(
    agent,
    "listClientTools",
    "clientTools",
    (clientTools, options) =>
      filterAuthorizedRecord(
        clientTools,
        options,
        concealToolInstanceDependencies,
      ),
  );
  installLockedMethodWrapper(agent, "getDefaultOptions", (currentMethod) => {
    return function (this: MastraAgent, ...args: unknown[]) {
      const raw = currentMethod.apply(this, args);
      if (isPromiseLike(raw)) {
        return Promise.resolve(raw).then((resolved) =>
          filterDefaultOptionsCapabilities(resolved, args[0]),
        );
      }
      return filterDefaultOptionsCapabilities(raw, args[0]);
    };
  });

  const currentFork = Reflect.get(agent, "__fork") as
    | ((() => MastraAgent) & { [WRAPPED_AGENT_FORK]?: true })
    | undefined;
  if (typeof currentFork === "function" && !currentFork[WRAPPED_AGENT_FORK]) {
    const wrappedFork = function (
      this: MastraAgent & DiscoveryWrappedPrimitive,
      ...args: unknown[]
    ): MastraAgent {
      const forked = Reflect.apply(currentFork, this, args) as MastraAgent &
        DiscoveryWrappedPrimitive;
      Object.defineProperty(forked, SOURCE_PRIMITIVE, {
        value: this[SOURCE_PRIMITIVE] ?? this,
        configurable: false,
        enumerable: false,
        writable: false,
      });
      wrapAgentDiscovery(forked);
      return forked;
    } as (() => MastraAgent) & { [WRAPPED_AGENT_FORK]?: true };

    Object.defineProperty(wrappedFork, WRAPPED_AGENT_FORK, {
      value: true,
      enumerable: false,
    });

    Object.defineProperty(agent, "__fork", {
      value: wrappedFork,
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
}
