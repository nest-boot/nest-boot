import { expectTypeOf } from "vitest";
import { z } from "zod";

import type { BaseStepOptions } from "../interfaces/base-step-options.interface.js";
import { BaseStep } from "../steps/base.step.js";
import type {
  StepExecuteParams,
  StepInput,
  StepOutput,
  StepRequestContext,
  StepResume,
  StepState,
  StepSuspend,
} from "./step.type.js";

/**
 * Compile-time schema extraction contracts for `BaseStep` and `BaseStepOptions`.
 */
export function verifyStepTypeInference(): void {
  const inputSchema = z.object({ query: z.string() });
  const outputSchema = z.object({ count: z.number() });
  const stateSchema = z.object({ attempts: z.number() });
  const suspendSchema = z.object({ reason: z.string() });
  const resumeSchema = z.object({ approved: z.boolean() });
  const requestContextSchema = z.object({ tenantId: z.string() });

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
}
