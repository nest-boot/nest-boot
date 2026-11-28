import { z } from "zod";

import { BaseStep } from "./base.step.js";

const schema = z.object({ value: z.string() });

describe("BaseStep", () => {
  it("normalizes optional schemas and validates their values", async () => {
    class StatefulStep extends BaseStep({
      id: "validate-content",
      description: "Validate content before publishing",
      inputSchema: schema,
      outputSchema: schema,
      stateSchema: z.object({ attempts: z.coerce.number() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string().min(1) }),
      requestContextSchema: z.object({ tenantId: z.string().min(1) }),
    }) {
      execute({ inputData }: { inputData: { value: string } }) {
        return Promise.resolve(inputData);
      }
    }

    const step = new StatefulStep({ retries: 2 });
    expect(step.id).toBe("validate-content");
    expect(step.description).toBe("Validate content before publishing");
    expect(step.retries).toBe(2);
    expect(
      await step.stateSchema?.["~standard"].validate({ attempts: "2" }),
    ).toEqual({ value: { attempts: 2 } });
    expect(
      await step.resumeSchema?.["~standard"].validate({ approved: true }),
    ).toEqual({ value: { approved: true } });
    expect(
      await step.suspendSchema?.["~standard"].validate({ reason: "review" }),
    ).toEqual({ value: { reason: "review" } });
    expect(
      await step.requestContextSchema?.["~standard"].validate({
        tenantId: "tenant-1",
      }),
    ).toEqual({ value: { tenantId: "tenant-1" } });

    for (const optionalSchema of [
      step.stateSchema,
      step.resumeSchema,
      step.suspendSchema,
      step.requestContextSchema,
    ]) {
      expect(await optionalSchema?.["~standard"].validate({})).toHaveProperty(
        "issues",
      );
    }
  });

  it("binds execute to the concrete step and permits omitted optional schemas", async () => {
    class EchoStep extends BaseStep({
      inputSchema: schema,
      outputSchema: schema,
    }) {
      private readonly prefix = "echo:";

      execute({ inputData }: { inputData: { value: string } }) {
        return Promise.resolve({ value: `${this.prefix}${inputData.value}` });
      }
    }

    const step = new EchoStep();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Verify BaseStep's callback remains bound when detached.
    const { execute } = step;
    await expect(execute({ inputData: { value: "article" } })).resolves.toEqual(
      { value: "echo:article" },
    );
    expect(step.id).toBe("echo-step");
    expect(step.stateSchema).toBeUndefined();
    expect(step.resumeSchema).toBeUndefined();
    expect(step.suspendSchema).toBeUndefined();
    expect(step.requestContextSchema).toBeUndefined();
    expect(step).toBeInstanceOf(BaseStep);
    expect({}).not.toBeInstanceOf(BaseStep);
    expect(null).not.toBeInstanceOf(BaseStep);
  });
});
