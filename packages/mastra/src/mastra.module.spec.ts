import { ObservabilityStorageClickhouseVNext } from "@mastra/clickhouse";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore, MastraCompositeStore } from "@mastra/core/storage";
import {
  Workflow as MastraWorkflow,
  type WorkflowFinishCallbackResult,
  type WorkflowStartCallbackInfo,
} from "@mastra/core/workflows";
import { MastraService } from "@mastra/nestjs";
import { MastraStorageExporter, Observability } from "@mastra/observability";
import { ObservabilityPG, PostgresStore } from "@mastra/pg";
import { CAN_METADATA } from "@nest-boot/auth";
import { Injectable, Module, Scope } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { expectTypeOf } from "vitest";
import { z } from "zod";

import {
  BaseAgent,
  BaseStep,
  type BaseStepOptions,
  BaseWorkflow,
  type BaseWorkflowOptions,
  DEFAULT_MASTRA_API_PREFIX,
  MastraController,
  MastraManager,
  MastraModule,
  normalizeMastraApiOptions,
  normalizeMastraStudioOptions,
  resolveMastraApiPrefix,
  resolveMastraStudioBasePath,
  type StepInput,
  type StepOutput,
  type WorkflowInput,
  type WorkflowOutput,
} from "./index.js";

@Injectable()
class WriterAgent extends BaseAgent {
  constructor() {
    super({
      name: "Writer Agent",
      instructions: "Help draft articles.",
      model: "openai/gpt-4o-mini",
    });
  }
}

@Injectable()
class SeoReviewerAgent extends BaseAgent {
  constructor() {
    super({
      id: "seo-reviewer",
      name: "SEO Reviewer",
      instructions: "Review SEO metadata.",
      model: "openai/gpt-4o-mini",
    });
  }
}

@Injectable()
class DirectMastraAgent extends MastraAgent {
  constructor() {
    super({
      id: "direct-agent",
      name: "Direct Agent",
      instructions: "Direct subclass of Mastra Agent.",
      model: "openai/gpt-4o-mini",
    });
  }
}

@Injectable()
class SummarizeArticleStep extends BaseStep({
  inputSchema: z.object({ title: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
}) {
  private readonly prefix = "Summary: ";

  execute({ inputData }: { inputData: { title: string } }) {
    return Promise.resolve({ summary: `${this.prefix}${inputData.title}` });
  }
}

@Injectable()
class FormatSummaryStep extends BaseStep({
  inputSchema: z.object({ summary: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
}) {
  execute({ inputData }: { inputData: { summary: string } }) {
    return Promise.resolve({ formatted: `[${inputData.summary}]` });
  }
}

@Injectable()
class ArticlePublishWorkflow extends BaseWorkflow({
  description: "Summarizes and formats article titles.",
  inputSchema: z.object({ title: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
}) {
  readonly lifecycleEvents: string[] = [];

  constructor(
    summarizeArticleStep: SummarizeArticleStep,
    formatSummaryStep: FormatSummaryStep,
  ) {
    super();

    this.then(summarizeArticleStep).then(formatSummaryStep).commit();
  }

  override onStart(info: WorkflowStartCallbackInfo): void {
    this.lifecycleEvents.push(`start:${info.workflowId}`);
  }

  override onFinish(result: WorkflowFinishCallbackResult): void {
    this.lifecycleEvents.push(`finish:${result.status}`);
  }
}

@Injectable()
class CustomIdWorkflow extends BaseWorkflow({
  id: "custom-review-flow",
  inputSchema: z.object({ title: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
}) {
  constructor(summarizeArticleStep: SummarizeArticleStep) {
    super();
    this.then(summarizeArticleStep).commit();
  }
}

@Module({
  providers: [
    WriterAgent,
    SummarizeArticleStep,
    FormatSummaryStep,
    ArticlePublishWorkflow,
  ],
  exports: [
    WriterAgent,
    SummarizeArticleStep,
    FormatSummaryStep,
    ArticlePublishWorkflow,
  ],
})
class WriterFeatureModule {}

@Module({
  imports: [WriterFeatureModule],
  providers: [SeoReviewerAgent, DirectMastraAgent, CustomIdWorkflow],
  exports: [SeoReviewerAgent, DirectMastraAgent, CustomIdWorkflow],
})
class ReviewFeatureModule {}

const ORIGINAL_ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  MASTRA_DATABASE_URL: process.env.MASTRA_DATABASE_URL,
  MASTRA_CLICKHOUSE_URL: process.env.MASTRA_CLICKHOUSE_URL,
};

describe("MastraModule", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.MASTRA_DATABASE_URL;
    delete process.env.MASTRA_CLICKHOUSE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_ENV.DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_ENV.DATABASE_URL;
    }
    if (ORIGINAL_ENV.MASTRA_DATABASE_URL === undefined) {
      delete process.env.MASTRA_DATABASE_URL;
    } else {
      process.env.MASTRA_DATABASE_URL = ORIGINAL_ENV.MASTRA_DATABASE_URL;
    }
    if (ORIGINAL_ENV.MASTRA_CLICKHOUSE_URL === undefined) {
      delete process.env.MASTRA_CLICKHOUSE_URL;
    } else {
      process.env.MASTRA_CLICKHOUSE_URL = ORIGINAL_ENV.MASTRA_CLICKHOUSE_URL;
    }
  });

  it("auto-discovers Agent and Workflow providers, preserves native .then() typing, and invokes lifecycle hooks", async () => {
    expectTypeOf<StepInput<SummarizeArticleStep>>().toEqualTypeOf<{
      title: string;
    }>();
    expectTypeOf<StepOutput<SummarizeArticleStep>>().toEqualTypeOf<{
      summary: string;
    }>();
    expectTypeOf<WorkflowInput<ArticlePublishWorkflow>>().toEqualTypeOf<{
      title: string;
    }>();
    expectTypeOf<WorkflowOutput<ArticlePublishWorkflow>>().toEqualTypeOf<{
      formatted: string;
    }>();
    expectTypeOf<BaseStepOptions>().not.toHaveProperty("id");
    expectTypeOf<BaseStepOptions>().not.toHaveProperty("description");
    expectTypeOf<BaseStepOptions>().not.toHaveProperty("inputSchema");
    expectTypeOf<BaseStepOptions>().not.toHaveProperty("outputSchema");
    expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("id");
    expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("description");
    expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("inputSchema");
    expectTypeOf<BaseWorkflowOptions>().not.toHaveProperty("outputSchema");

    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule, WriterFeatureModule, ReviewFeatureModule],
    }).compile();

    await moduleRef.init();

    try {
      const mastra = moduleRef.get(Mastra);
      const mastraService = moduleRef.get(MastraService);
      const manager = moduleRef.get(MastraManager);
      const writerAgent = moduleRef.get(WriterAgent);
      const seoAgent = moduleRef.get(SeoReviewerAgent);
      const directAgent = moduleRef.get(DirectMastraAgent);
      const summarizeStep = moduleRef.get(SummarizeArticleStep);
      const publishWorkflow = moduleRef.get(ArticlePublishWorkflow);
      const customWorkflow = moduleRef.get(CustomIdWorkflow);

      expect(mastraService.getMastra()).toBe(mastra);
      expect(mastraService.getOptions().prefix).toBe(DEFAULT_MASTRA_API_PREFIX);

      const canMetadata = Reflect.getMetadata(
        CAN_METADATA,
        MastraController,
      ) as { action: string; subject: unknown }[];
      expect(canMetadata).toEqual([{ action: "manage", subject: Mastra }]);

      expect(writerAgent).toBeInstanceOf(BaseAgent);
      expect(writerAgent).toBeInstanceOf(MastraAgent);
      expect(summarizeStep).toBeInstanceOf(BaseStep);
      expect(publishWorkflow).toBeInstanceOf(BaseWorkflow);
      expect(publishWorkflow).toBeInstanceOf(MastraWorkflow);

      expect(writerAgent.id).toBe("writer-agent");
      expect(seoAgent.id).toBe("seo-reviewer");
      expect(directAgent.id).toBe("direct-agent");
      expect(summarizeStep.id).toBe("summarize-article-step");
      expect(publishWorkflow.id).toBe("article-publish-workflow");
      expect(customWorkflow.id).toBe("custom-review-flow");

      expect(mastra.getAgent("writer-agent")).toBe(writerAgent);
      expect(mastra.getAgent("seo-reviewer")).toBe(seoAgent);
      expect(mastra.getAgent("direct-agent")).toBe(directAgent);
      expect(mastra.getWorkflow("article-publish-workflow")).toBe(
        publishWorkflow,
      );
      expect(mastra.getWorkflow("custom-review-flow")).toBe(customWorkflow);

      expect(manager.getAgents().map((agent) => agent.id)).toEqual(
        expect.arrayContaining([
          "writer-agent",
          "seo-reviewer",
          "direct-agent",
        ]),
      );
      expect(manager.getAgent("writer-agent")).toBe(writerAgent);
      expect(manager.getWorkflows().map((workflow) => workflow.id)).toEqual(
        expect.arrayContaining([
          "article-publish-workflow",
          "custom-review-flow",
        ]),
      );
      expect(manager.getWorkflow("article-publish-workflow")).toBe(
        publishWorkflow,
      );

      const run = await publishWorkflow.createRun();
      const result = await run.start({ inputData: { title: "NestJS Mastra" } });

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.result).toEqual({
          formatted: "[Summary: NestJS Mastra]",
        });
      }
      expect(publishWorkflow.lifecycleEvents).toEqual([
        "start:article-publish-workflow",
        "finish:success",
      ]);
    } finally {
      await moduleRef.close();
    }
  });

  it("supports MastraModule.forRoot and forRootAsync options alongside auto-discovery", async () => {
    const preconfiguredAgent = new MastraAgent({
      id: "preconfigured-agent",
      name: "Preconfigured Agent",
      instructions: "Registered via forRoot options.",
      model: "openai/gpt-4o-mini",
    });

    const syncModuleRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRoot({
          agents: {
            "preconfigured-agent": preconfiguredAgent,
          },
        }),
        WriterFeatureModule,
      ],
    }).compile();

    await syncModuleRef.init();

    try {
      const mastra = syncModuleRef.get(Mastra);
      expect(mastra.getAgent("preconfigured-agent")).toBe(preconfiguredAgent);
      expect(mastra.getAgent("writer-agent")).toBe(
        syncModuleRef.get(WriterAgent),
      );
    } finally {
      await syncModuleRef.close();
    }

    const asyncModuleRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRootAsync({
          useFactory: () => ({
            agents: {
              "preconfigured-agent": preconfiguredAgent,
            },
          }),
        }),
        WriterFeatureModule,
      ],
    }).compile();

    await asyncModuleRef.init();

    try {
      const mastra = asyncModuleRef.get(Mastra);
      expect(mastra.getAgent("preconfigured-agent")).toBe(preconfiguredAgent);
      expect(mastra.getAgent("writer-agent")).toBe(
        asyncModuleRef.get(WriterAgent),
      );
    } finally {
      await asyncModuleRef.close();
    }
  });

  it("throws when two distinct agent providers register the same id", async () => {
    @Injectable()
    class DuplicateAgentA extends BaseAgent {
      constructor() {
        super({
          id: "shared-agent",
          name: "Duplicate A",
          instructions: "First agent.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    @Injectable()
    class DuplicateAgentB extends BaseAgent {
      constructor() {
        super({
          id: "shared-agent",
          name: "Duplicate B",
          instructions: "Second agent.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [DuplicateAgentA, DuplicateAgentB],
    }).compile();

    try {
      await expect(moduleRef.init()).rejects.toThrow(
        /Mastra agent "shared-agent" has multiple providers/,
      );
    } finally {
      await moduleRef.close().catch(() => undefined);
    }
  });

  it("throws when two distinct workflow providers register the same id", async () => {
    @Injectable()
    class DuplicateWorkflowA extends BaseWorkflow({
      id: "shared-workflow",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }) {
      constructor() {
        super();
        this.commit();
      }
    }

    @Injectable()
    class DuplicateWorkflowB extends BaseWorkflow({
      id: "shared-workflow",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }) {
      constructor() {
        super();
        this.commit();
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [DuplicateWorkflowA, DuplicateWorkflowB],
    }).compile();

    try {
      await expect(moduleRef.init()).rejects.toThrow(
        /Mastra workflow "shared-workflow" has multiple providers/,
      );
    } finally {
      await moduleRef.close().catch(() => undefined);
    }
  });

  it("rejects non-singleton agent and workflow providers", async () => {
    @Injectable({ scope: Scope.REQUEST })
    class RequestScopedAgent extends BaseAgent {
      constructor() {
        super({
          name: "Request Scoped Agent",
          instructions: "Should fail discovery.",
          model: "openai/gpt-4o-mini",
        });
      }
    }

    const agentModule = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [RequestScopedAgent],
    }).compile();

    try {
      await expect(agentModule.init()).rejects.toThrow(
        /must be a singleton Mastra Agent provider/,
      );
    } finally {
      await agentModule.close().catch(() => undefined);
    }

    @Injectable({ scope: Scope.TRANSIENT })
    class TransientWorkflow extends BaseWorkflow({
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }) {
      constructor() {
        super();
        this.commit();
      }
    }

    const workflowModule = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [TransientWorkflow],
    }).compile();

    try {
      await expect(workflowModule.init()).rejects.toThrow(
        /must be a singleton Mastra Workflow provider/,
      );
    } finally {
      await workflowModule.close().catch(() => undefined);
    }
  });

  it("resolves built-in PostgresStore and ClickHouse observability from env vars while allowing overrides", async () => {
    const pgInitSpy = vi
      .spyOn(PostgresStore.prototype, "init")
      .mockResolvedValue(undefined);
    const clickhouseInitSpy = vi
      .spyOn(ObservabilityStorageClickhouseVNext.prototype, "init")
      .mockResolvedValue(undefined);

    try {
      const noDbRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await noDbRef.init();
      try {
        const noDbMastra = noDbRef.get(Mastra);
        expect(noDbMastra.getStorage()).toBeInstanceOf(InMemoryStore);
        expect(noDbMastra.getStorage()).not.toBeInstanceOf(PostgresStore);
        expect(noDbMastra.observability).toBeInstanceOf(Observability);
      } finally {
        await noDbRef.close();
      }

      process.env.DATABASE_URL = "memory://";
      const pgliteRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await pgliteRef.init();
      try {
        const pgliteMastra = pgliteRef.get(Mastra);
        expect(pgliteMastra.getStorage()).toBeInstanceOf(InMemoryStore);
        expect(pgliteMastra.getStorage()).not.toBeInstanceOf(PostgresStore);
      } finally {
        await pgliteRef.close();
      }

      // MASTRA_DATABASE_URL overrides DATABASE_URL even when DATABASE_URL is PostgreSQL
      process.env.DATABASE_URL =
        "postgresql://postgres:secret@localhost:5432/postgres";
      process.env.MASTRA_DATABASE_URL = "memory://";
      const overriddenToNonPgRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await overriddenToNonPgRef.init();
      try {
        const mastra = overriddenToNonPgRef.get(Mastra);
        expect(mastra.getStorage()).toBeInstanceOf(InMemoryStore);
        expect(mastra.getStorage()).not.toBeInstanceOf(PostgresStore);
      } finally {
        await overriddenToNonPgRef.close();
      }

      // MASTRA_DATABASE_URL enables PostgresStore even when DATABASE_URL is PGlite
      process.env.DATABASE_URL = "memory://";
      process.env.MASTRA_DATABASE_URL =
        "postgresql://postgres:secret@localhost:5432/mastra_dedicated";
      const dedicatedPgRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await dedicatedPgRef.init();
      const dedicatedPgMastra = dedicatedPgRef.get(Mastra);
      const shutdownSpy = vi.spyOn(dedicatedPgMastra, "shutdown");
      try {
        const storage = dedicatedPgMastra.getStorage();
        expect(storage).toBeInstanceOf(PostgresStore);
        expect(storage?.id).toBe("mastra-storage");
        expect((storage as PostgresStore).stores.observability).toBeInstanceOf(
          ObservabilityPG,
        );
        expect(dedicatedPgMastra.observability).toBeInstanceOf(Observability);
      } finally {
        await dedicatedPgRef.close();
      }
      expect(shutdownSpy).toHaveBeenCalledTimes(1);

      // PostgresStore + ClickHouse vNext observability composite
      process.env.MASTRA_CLICKHOUSE_URL =
        "http://default:secret@localhost:8123/mastra_obs";
      const pgWithClickhouseRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await pgWithClickhouseRef.init();
      try {
        const storage = pgWithClickhouseRef.get(Mastra).getStorage();
        expect(storage).toBeInstanceOf(MastraCompositeStore);
        expect(storage?.id).toBe("composite-storage");
        expect(storage?.stores?.observability).toBeInstanceOf(
          ObservabilityStorageClickhouseVNext,
        );
        expect(storage?.stores?.memory).not.toBeUndefined();
      } finally {
        await pgWithClickhouseRef.close();
      }

      // ClickHouse observability with non-PostgreSQL DATABASE_URL
      delete process.env.MASTRA_DATABASE_URL;
      process.env.DATABASE_URL = "memory://";
      process.env.MASTRA_CLICKHOUSE_URL =
        "clickhouse://admin:pass@localhost:8123/analytics";
      const clickhouseOnlyRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await clickhouseOnlyRef.init();
      try {
        const storage = clickhouseOnlyRef.get(Mastra).getStorage();
        expect(storage).toBeInstanceOf(MastraCompositeStore);
        expect(storage?.stores?.observability).toBeInstanceOf(
          ObservabilityStorageClickhouseVNext,
        );
      } finally {
        await clickhouseOnlyRef.close();
      }

      const customStorage = new PostgresStore({
        id: "custom-pg-storage",
        connectionString:
          "postgres://postgres:secret@localhost:5432/custom_mastra",
        schemaName: "custom_mastra",
        disableInit: true,
      });
      const customObservability = new Observability({
        configs: {
          default: {
            serviceName: "custom-mastra",
            exporters: [new MastraStorageExporter()],
          },
        },
      });

      // Invalid URLs and unsupported protocols safely fall back to in-memory storage
      process.env.DATABASE_URL = "not-a-valid-url";
      process.env.MASTRA_CLICKHOUSE_URL = "ftp://localhost:8123";
      const invalidEnvRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await invalidEnvRef.init();
      try {
        expect(invalidEnvRef.get(Mastra).getStorage()).toBeInstanceOf(
          InMemoryStore,
        );
      } finally {
        await invalidEnvRef.close();
      }

      process.env.MASTRA_CLICKHOUSE_URL = "not-a-valid-url";
      const badClickhouseRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await badClickhouseRef.init();
      try {
        expect(badClickhouseRef.get(Mastra).getStorage()).toBeInstanceOf(
          InMemoryStore,
        );
      } finally {
        await badClickhouseRef.close();
      }

      // Empty MASTRA_DATABASE_URL falls back to DATABASE_URL; clickhouses:// without credentials works
      process.env.MASTRA_DATABASE_URL = "   ";
      process.env.DATABASE_URL =
        "postgres://postgres:secret@localhost:5432/fallback_db";
      process.env.MASTRA_CLICKHOUSE_URL = "clickhouses://localhost:8443/obs";
      const fallbackPgAndChRef = await Test.createTestingModule({
        imports: [MastraModule],
      }).compile();
      await fallbackPgAndChRef.init();
      try {
        const storage = fallbackPgAndChRef.get(Mastra).getStorage();
        expect(storage).toBeInstanceOf(MastraCompositeStore);
        expect(storage?.stores?.observability).toBeInstanceOf(
          ObservabilityStorageClickhouseVNext,
        );
      } finally {
        await fallbackPgAndChRef.close();
      }

      delete process.env.MASTRA_DATABASE_URL;
      delete process.env.DATABASE_URL;
      delete process.env.MASTRA_CLICKHOUSE_URL;
      const customModuleRef = await Test.createTestingModule({
        imports: [
          MastraModule.forRoot({
            storage: customStorage,
            observability: customObservability,
          }),
        ],
      }).compile();
      await customModuleRef.init();
      try {
        const customMastra = customModuleRef.get(Mastra);
        expect(customMastra.getStorage()).toBeInstanceOf(PostgresStore);
        expect(customMastra.getStorage()?.id).toBe("custom-pg-storage");
        expect(customMastra.observability).toBe(customObservability);
      } finally {
        await customModuleRef.close();
      }
    } finally {
      pgInitSpy.mockRestore();
      clickhouseInitSpy.mockRestore();
    }
  });

  it("normalizes module options, supports static forRootAsync api: false, preconfigured workflows, and workflow onError", async () => {
    expect(resolveMastraApiPrefix("/")).toBe("/api");
    expect(resolveMastraStudioBasePath("/custom")).toBe("/custom/studio");
    expect(normalizeMastraApiOptions(false)).toEqual({
      enabled: false,
      serverOptions: { prefix: DEFAULT_MASTRA_API_PREFIX },
    });
    expect(normalizeMastraStudioOptions(true, false)).toEqual({
      enabled: true,
      hideCloudCta: true,
      telemetryDisabled: true,
    });
    expect(normalizeMastraStudioOptions(false, true)).toEqual({
      enabled: false,
      hideCloudCta: true,
      telemetryDisabled: true,
    });

    @Injectable()
    class FailingStep extends BaseStep({
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }) {
      execute(): Promise<{ value: string }> {
        return Promise.reject(new Error("boom"));
      }
    }

    @Injectable()
    class FailingWorkflow extends BaseWorkflow({
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }) {
      readonly errors: string[] = [];

      constructor(failingStep: FailingStep) {
        super();
        this.then(failingStep).commit();
      }

      override onError(errorInfo: { error?: Error }): void {
        this.errors.push(errorInfo.error?.message ?? "unknown");
      }
    }

    const preconfiguredWorkflow = new MastraWorkflow({
      id: "preconfigured-workflow",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });
    preconfiguredWorkflow.commit();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.forRootAsync({
          api: false,
          useFactory: () => ({
            workflows: {
              "preconfigured-workflow": preconfiguredWorkflow,
            },
          }),
        }),
      ],
      providers: [
        FailingStep,
        FailingWorkflow,
        {
          provide: "REUSED_WORKFLOW_ALIAS",
          useValue: preconfiguredWorkflow,
        },
      ],
    }).compile();

    await moduleRef.init();
    try {
      expect(() =>
        moduleRef.get(MastraController, { strict: false }),
      ).toThrow();

      const manager = moduleRef.get(MastraManager);
      expect(manager.getWorkflow("preconfigured-workflow")).toBe(
        preconfiguredWorkflow,
      );

      const failingWorkflow = moduleRef.get(FailingWorkflow);
      const run = await failingWorkflow.createRun();
      const result = await run.start({ inputData: { value: "fail" } });
      expect(result.status).toBe("failed");
      expect(failingWorkflow.errors).toEqual(["boom"]);

      // Calling shutdown twice is idempotent
      await manager.onApplicationShutdown();
      await manager.onApplicationShutdown();
    } finally {
      await moduleRef.close();
    }
  });
});
