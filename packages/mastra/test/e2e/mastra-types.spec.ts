import type { Tool } from "@mastra/core/tools";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  BaseStep,
  BaseTool,
  BaseWorkflow,
  MastraModule,
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
  type WorkflowRequestContext,
  type WorkflowState,
} from "../../src/index.js";

describe("Mastra type contracts (e2e)", () => {
  it("preserves schema inference for tools, steps, and workflows", () => {
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
      execute() {
        return Promise.resolve({ count: 1 });
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

    class SearchWorkflow extends BaseWorkflow({
      inputSchema,
      outputSchema,
      stateSchema,
      requestContextSchema,
    }) {}
    expectTypeOf<WorkflowState<SearchWorkflow>>().toEqualTypeOf<
      z.infer<typeof stateSchema>
    >();
    expectTypeOf<WorkflowRequestContext<SearchWorkflow>>().toEqualTypeOf<
      z.infer<typeof requestContextSchema>
    >();
  });

  it("rejects unsupported HTTP configuration at compile time", () => {
    // @ts-expect-error NestJS owns server configuration, including empty objects.
    MastraModule.forRoot({ server: {} });
    const serverOptions = { server: { port: 4111 } };
    // @ts-expect-error Variables must not bypass the server configuration boundary.
    MastraModule.forRoot(serverOptions);
    const asyncOptions = { useFactory: () => Promise.resolve(serverOptions) };
    // @ts-expect-error Async factories must not return server configuration.
    MastraModule.forRootAsync(asyncOptions);
    // @ts-expect-error NestJS guards own authentication.
    MastraModule.forRoot({ api: { auth: { enabled: true } } });
    // @ts-expect-error Custom routes belong to NestJS controllers.
    MastraModule.forRoot({ api: { customRouteAuthConfig: new Map() } });
  });
});
