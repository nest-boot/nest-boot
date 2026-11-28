import "reflect-metadata";

import {
  createStep,
  Workflow,
  type WorkflowErrorCallbackInfo,
  type WorkflowFinishCallbackResult,
  type WorkflowStartCallbackInfo,
} from "@mastra/core/workflows";
import { z } from "zod";

import type { BaseWorkflowOptions } from "../interfaces/base-workflow-options.interface.js";
import { BaseWorkflow } from "./base.workflow.js";

const schema = z.object({ value: z.string() });

describe("BaseWorkflow", () => {
  it("commits a native graph without becoming a Promise thenable or breaking metadata scans", async () => {
    class ArticlePublishWorkflow extends BaseWorkflow({
      inputSchema: schema,
      outputSchema: schema,
    }) {}

    const workflow = new ArticlePublishWorkflow();
    expect(workflow.id).toBe("article-publish-workflow");
    expect(workflow).toBeInstanceOf(Workflow);
    expect(workflow).toBeInstanceOf(BaseWorkflow);
    expect({}).not.toBeInstanceOf(BaseWorkflow);
    expect(null).not.toBeInstanceOf(BaseWorkflow);
    expect(typeof workflow.then).toBe("function");

    const committed = workflow
      .then(
        createStep({
          id: "echo",
          inputSchema: schema,
          outputSchema: schema,
          execute: ({ inputData }) => Promise.resolve(inputData),
        }),
      )
      .commit();

    expect(committed).toBe(workflow);
    expect(workflow.committed).toBe(true);
    const then: unknown = Reflect.get(workflow, "then");
    expect(typeof then).toBe("object");
    expect(Reflect.getMetadata("schedule", then as object)).toBeUndefined();
    const provider: unknown = workflow;
    await expect(Promise.resolve(provider)).resolves.toBe(workflow);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: "published" } });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.result).toEqual({ value: "published" });
    }
  });

  it("preserves explicit identity, optional schemas, and runtime options", () => {
    class CustomWorkflow extends BaseWorkflow({
      id: "custom-flow",
      description: "A configured workflow",
      inputSchema: schema,
      outputSchema: schema,
      stateSchema: z.object({ attempts: z.number() }),
      requestContextSchema: z.object({ tenantId: z.string() }),
    }) {}

    const workflow = new CustomWorkflow({
      metadata: { owner: "editor" },
      retryConfig: { attempts: 2, delay: 0 },
    });
    expect(workflow.id).toBe("custom-flow");
    expect(workflow.description).toBe("A configured workflow");
    expect(workflow.metadata).toEqual({ owner: "editor" });
    expect(workflow.retryConfig).toEqual({ attempts: 2, delay: 0 });
    expect(workflow.stateSchema).toBeDefined();
    expect(workflow.requestContextSchema).toBeDefined();
  });

  describe.each(["methods", "options", "both"] as const)(
    "%s lifecycle hooks",
    (source) => {
      it.each([false, true])(
        "awaits callbacks in order and preserves instance binding (failed: %s)",
        async (failed) => {
          const events: string[] = [];
          const error = new Error("step failed");
          const onStart = vi.fn(async () => {
            await Promise.resolve();
            events.push("options:start");
          });
          const onFinish = vi.fn(async () => {
            await Promise.resolve();
            events.push("options:finish");
          });
          const onError = vi.fn(async () => {
            await Promise.resolve();
            events.push("options:error");
          });

          class PlainWorkflow extends BaseWorkflow({
            inputSchema: schema,
            outputSchema: schema,
          }) {
            constructor(options?: BaseWorkflowOptions) {
              super(options);
              this.then(
                createStep({
                  id: "execute",
                  inputSchema: schema,
                  outputSchema: schema,
                  execute: ({ inputData }) =>
                    failed ? Promise.reject(error) : Promise.resolve(inputData),
                }),
              ).commit();
            }
          }

          class HookedWorkflow extends PlainWorkflow {
            override onStart(info: WorkflowStartCallbackInfo): void {
              expect(info.workflowId).toBe(this.id);
              events.push("methods:start");
            }

            override onFinish(result: WorkflowFinishCallbackResult): void {
              expect(this).toBeInstanceOf(HookedWorkflow);
              expect(result.status).toBe(failed ? "failed" : "success");
              events.push("methods:finish");
            }

            override onError(info: WorkflowErrorCallbackInfo): void {
              expect(this).toBeInstanceOf(HookedWorkflow);
              expect(info.error?.message).toBe(error.message);
              events.push("methods:error");
            }
          }

          const WorkflowClass =
            source === "options" ? PlainWorkflow : HookedWorkflow;
          const workflow = new WorkflowClass(
            source === "methods"
              ? undefined
              : {
                  options: { onStart, onFinish, onError },
                },
          );
          const run = await workflow.createRun();
          const result = await run.start({ inputData: { value: "article" } });
          expect(result.status).toBe(failed ? "failed" : "success");

          const expected = (event: string) => [
            ...(source !== "methods" ? [`options:${event}`] : []),
            ...(source !== "options" ? [`methods:${event}`] : []),
          ];
          expect(events.filter((event) => event.endsWith(":start"))).toEqual(
            expected("start"),
          );
          expect(events.filter((event) => event.endsWith(":finish"))).toEqual(
            expected("finish"),
          );
          expect(events.filter((event) => event.endsWith(":error"))).toEqual(
            failed ? expected("error") : [],
          );
          if (source !== "methods") {
            expect(onStart).toHaveBeenCalledOnce();
            expect(onFinish).toHaveBeenCalledOnce();
            expect(onError).toHaveBeenCalledTimes(failed ? 1 : 0);
          }
        },
      );
    },
  );
});
