import type { Tool } from "@mastra/core/tools";
import { expectTypeOf } from "vitest";
import { z } from "zod";

import {
  BaseStep,
  type BaseStepOptions,
  BaseTool,
  BaseWorkflow,
  type BaseWorkflowOptions,
  MastraModule,
  type StepExecuteParams,
  type StepInput,
  type StepOutput,
  type StepRequestContext,
  type StepResume,
  type StepState,
  type StepSuspend,
  type ToolContext,
  type ToolInput,
  type ToolOutput,
  type ToolRequestContext,
  type ToolResume,
  type ToolSuspend,
  type WorkflowInput,
  type WorkflowOutput,
  type WorkflowRequestContext,
  type WorkflowState,
} from "../src/index.js";

/**
 * Compile-time type contract suite checked by `pnpm --filter @nest-boot/mastra typecheck`
 * and excluded from runtime tests and package builds.
 */
export function verifyMastraTypeContracts(): void {
  const inputSchema = z.object({ query: z.string() });
  const outputSchema = z.object({ count: z.number() });
  const stateSchema = z.object({ attempts: z.number() });
  const suspendSchema = z.object({ reason: z.string() });
  const resumeSchema = z.object({ approved: z.boolean() });
  const requestContextSchema = z.object({ tenantId: z.string() });

  class SearchTool extends BaseTool({
    description: "Search documents",
    inputSchema,
    outputSchema,
    suspendSchema,
    resumeSchema,
    requestContextSchema,
  }) {
    execute(input: ToolInput<SearchTool>, context?: ToolContext<SearchTool>) {
      expectTypeOf(context?.requestContext.get("tenantId")).toEqualTypeOf<
        string | undefined
      >();
      return Promise.resolve({ count: input.query.length });
    }
  }

  expectTypeOf<ToolInput<SearchTool>>().toEqualTypeOf<
    z.infer<typeof inputSchema>
  >();
  expectTypeOf<ToolOutput<SearchTool>>().toEqualTypeOf<
    z.infer<typeof outputSchema>
  >();
  expectTypeOf<ToolSuspend<SearchTool>>().toEqualTypeOf<
    z.infer<typeof suspendSchema>
  >();
  expectTypeOf<ToolResume<SearchTool>>().toEqualTypeOf<
    z.infer<typeof resumeSchema>
  >();
  expectTypeOf<ToolRequestContext<SearchTool>>().toEqualTypeOf<
    z.infer<typeof requestContextSchema>
  >();
  expectTypeOf<
    ToolInput<Tool<{ query: string }, { count: number }>>
  >().toEqualTypeOf<{ query: string }>();
  expectTypeOf<
    ToolOutput<Tool<{ query: string }, { count: number }>>
  >().toEqualTypeOf<{ count: number }>();
  expectTypeOf<ToolInput<Tool>>().toBeUnknown();
  expectTypeOf<ToolSuspend<Tool>>().toBeUnknown();
  expectTypeOf<ToolRequestContext<Tool>>().toBeUnknown();
  expectTypeOf<
    ToolRequestContext<
      Tool<
        unknown,
        unknown,
        unknown,
        unknown,
        any,
        string,
        { tenantId: string }
      >
    >
  >().toEqualTypeOf<{ tenantId: string }>();

  class SearchStep extends BaseStep({
    inputSchema,
    outputSchema,
    stateSchema,
    resumeSchema,
    suspendSchema,
    requestContextSchema,
  }) {
    execute(params: StepExecuteParams<SearchStep>) {
      return Promise.resolve({ count: params.inputData.query.length });
    }
  }

  expectTypeOf<StepInput<SearchStep>>().toEqualTypeOf<
    z.infer<typeof inputSchema>
  >();
  expectTypeOf<StepOutput<SearchStep>>().toEqualTypeOf<
    z.infer<typeof outputSchema>
  >();
  expectTypeOf<StepState<SearchStep>>().toEqualTypeOf<
    z.infer<typeof stateSchema>
  >();
  expectTypeOf<StepResume<SearchStep>>().toEqualTypeOf<
    z.infer<typeof resumeSchema>
  >();
  expectTypeOf<StepSuspend<SearchStep>>().toEqualTypeOf<
    z.infer<typeof suspendSchema>
  >();
  expectTypeOf<StepRequestContext<SearchStep>>().toEqualTypeOf<
    z.infer<typeof requestContextSchema>
  >();
  expectTypeOf<BaseStepOptions>().not.toHaveProperty("id");
  expectTypeOf<BaseStepOptions>().not.toHaveProperty("description");
  expectTypeOf<BaseStepOptions>().not.toHaveProperty("inputSchema");
  expectTypeOf<BaseStepOptions>().not.toHaveProperty("outputSchema");

  class SearchWorkflow extends BaseWorkflow({
    inputSchema,
    outputSchema,
    stateSchema,
    requestContextSchema,
  }) {}

  expectTypeOf<WorkflowInput<SearchWorkflow>>().toEqualTypeOf<
    z.infer<typeof inputSchema>
  >();
  expectTypeOf<WorkflowOutput<SearchWorkflow>>().toEqualTypeOf<
    z.infer<typeof outputSchema>
  >();
  expectTypeOf<WorkflowState<SearchWorkflow>>().toEqualTypeOf<
    z.infer<typeof stateSchema>
  >();
  expectTypeOf<WorkflowRequestContext<SearchWorkflow>>().toEqualTypeOf<
    z.infer<typeof requestContextSchema>
  >();
  expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("id");
  expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("description");
  expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("inputSchema");
  expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("outputSchema");

  // @ts-expect-error Standalone Hono port belongs to NestJS.
  MastraModule.forRoot({ server: { port: 4111 } });
  const invalidServerOptions = { server: { port: 4111 } };
  // @ts-expect-error Variables must not bypass the server configuration boundary.
  MastraModule.forRoot(invalidServerOptions);
  const asyncOptions = {
    useFactory: () => Promise.resolve(invalidServerOptions),
  };
  // @ts-expect-error Async factories must not return standalone server configuration.
  MastraModule.forRootAsync(asyncOptions);
  // @ts-expect-error NestJS guards own authentication.
  MastraModule.forRoot({ server: { auth: { enabled: true } } });
  // @ts-expect-error Custom routes belong to NestJS controllers.
  MastraModule.forRoot({ server: { customRouteAuthConfig: new Map() } });
}
