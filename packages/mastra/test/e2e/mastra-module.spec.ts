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
import { ModulesContainer } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import {
  BaseAgent,
  BaseStep,
  BaseTool,
  BaseWorkflow,
  DEFAULT_MASTRA_SERVER_PREFIX,
  MastraController,
  MastraManager,
  MastraModule,
} from "../../src/index.js";

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

@Injectable()
class KeywordLookupTool extends BaseTool({
  description: "Looks up keywords",
  inputSchema: z.object({ q: z.string() }),
  outputSchema: z.object({ found: z.string() }),
}) {
  execute(input: { q: string }) {
    return Promise.resolve({ found: input.q });
  }
}

@Module({
  providers: [
    WriterAgent,
    KeywordLookupTool,
    SummarizeArticleStep,
    FormatSummaryStep,
    ArticlePublishWorkflow,
  ],
  exports: [
    WriterAgent,
    KeywordLookupTool,
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

describe("MastraModule provider discovery & storage (e2e)", () => {
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

  it("auto-discovers Tool, Agent, and Workflow providers and invokes workflow lifecycle hooks", async () => {
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
      const keywordTool = moduleRef.get(KeywordLookupTool);
      const summarizeStep = moduleRef.get(SummarizeArticleStep);
      const publishWorkflow = moduleRef.get(ArticlePublishWorkflow);
      const customWorkflow = moduleRef.get(CustomIdWorkflow);

      expect(mastraService.getMastra()).toBe(mastra);
      expect(mastraService.getOptions().prefix).toBe(
        DEFAULT_MASTRA_SERVER_PREFIX,
      );
      expect(() =>
        moduleRef.get(MastraController, { strict: false }),
      ).toThrow();

      expect(writerAgent).toBeInstanceOf(BaseAgent);
      expect(writerAgent).toBeInstanceOf(MastraAgent);
      expect(keywordTool).toBeInstanceOf(BaseTool);
      expect(summarizeStep).toBeInstanceOf(BaseStep);
      expect(publishWorkflow).toBeInstanceOf(BaseWorkflow);
      expect(publishWorkflow).toBeInstanceOf(MastraWorkflow);

      expect(writerAgent.id).toBe("writer-agent");
      expect(seoAgent.id).toBe("seo-reviewer");
      expect(directAgent.id).toBe("direct-agent");
      expect(keywordTool.id).toBe("keyword-lookup-tool");
      expect(summarizeStep.id).toBe("summarize-article-step");
      expect(publishWorkflow.id).toBe("article-publish-workflow");
      expect(customWorkflow.id).toBe("custom-review-flow");

      expect(manager.getTool("keyword-lookup-tool")).toBe(keywordTool);
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
          server: true,
          agents: {
            "preconfigured-agent": preconfiguredAgent,
          },
        }),
        WriterFeatureModule,
      ],
      providers: [{ provide: "REUSED_AGENT", useValue: preconfiguredAgent }],
    }).compile();

    await syncModuleRef.init();

    try {
      const modulesContainer = syncModuleRef.get(ModulesContainer);
      const controllerWrapper = [...modulesContainer.values()]
        .flatMap((mod) => [...mod.controllers.values()])
        .find((wrapper) => wrapper.instance instanceof MastraController);
      expect(controllerWrapper?.metatype).toBeDefined();
      const canMetadata = Reflect.getMetadata(
        CAN_METADATA,
        controllerWrapper?.metatype as object,
      ) as { action: string; subject: unknown }[];
      expect(canMetadata).toEqual([{ action: "manage", subject: Mastra }]);

      const mastra = syncModuleRef.get(Mastra);
      expect(mastra.getAgent("preconfigured-agent")).toBe(preconfiguredAgent);
      expect(
        syncModuleRef
          .get(MastraManager)
          .getAgents()
          .filter((agent) => agent.id === preconfiguredAgent.id),
      ).toEqual([preconfiguredAgent]);
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

  it("rejects duplicate IDs and non-singleton providers in NestJS DI containers", async () => {
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

    const dupModule = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [DuplicateAgentA, DuplicateAgentB],
    }).compile();

    try {
      await expect(dupModule.init()).rejects.toThrow(
        /Mastra agent "shared-agent" has multiple providers/,
      );
    } finally {
      await dupModule.close().catch(() => undefined);
    }

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

    const reqScopedModule = await Test.createTestingModule({
      imports: [MastraModule],
      providers: [RequestScopedAgent],
    }).compile();

    try {
      await expect(reqScopedModule.init()).rejects.toThrow(
        /must be a singleton Mastra Agent provider/,
      );
    } finally {
      await reqScopedModule.close().catch(() => undefined);
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
});
