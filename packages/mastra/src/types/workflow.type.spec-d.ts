import { expectTypeOf } from "vitest";
import { z } from "zod";

import type { BaseWorkflowOptions } from "../interfaces/base-workflow-options.interface.js";
import { BaseWorkflow } from "../workflows/base.workflow.js";
import type {
  WorkflowInput,
  WorkflowOutput,
  WorkflowRequestContext,
  WorkflowState,
} from "./workflow.type.js";

/**
 * Compile-time schema extraction contracts for `BaseWorkflow` and `BaseWorkflowOptions`.
 */
export function verifyWorkflowTypeInference(): void {
  const inputSchema = z.object({ query: z.string() });
  const outputSchema = z.object({ count: z.number() });
  const stateSchema = z.object({ attempts: z.number() });
  const requestContextSchema = z.object({ tenantId: z.string() });

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
}
