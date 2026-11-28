import type { Tool } from "@mastra/core/tools";
import { expectTypeOf } from "vitest";
import { z } from "zod";

import { BaseTool } from "../tools/base.tool.js";
import type {
  ToolContext,
  ToolInput,
  ToolOutput,
  ToolRequestContext,
  ToolResume,
  ToolSuspend,
} from "./tool.type.js";

/**
 * Compile-time schema extraction contracts for `BaseTool` and Mastra `Tool`.
 */
export function verifyToolTypeInference(): void {
  const inputSchema = z.object({ query: z.string() });
  const outputSchema = z.object({ count: z.number() });
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
}
