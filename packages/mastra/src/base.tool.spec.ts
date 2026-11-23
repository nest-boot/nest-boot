import {
  isValidationError,
  MASTRA_TOOL_MARKER,
  Tool as MastraTool,
} from "@mastra/core/tools";
import { Injectable } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { expectTypeOf } from "vitest";
import { z } from "zod";

import {
  BaseAgent,
  BaseTool,
  type BaseToolOptions,
  type ToolInput,
  type ToolOutput,
} from "./index.js";

describe("BaseTool", () => {
  it("supports injectable NestJS providers with schema validation, runtime options, and Agent integration", async () => {
    @Injectable()
    class ArticleCatalogService {
      findByKeyword(keyword: string): string[] {
        return [`article:${keyword}`];
      }
    }

    const executeSpy = vi.fn();

    @Injectable()
    class SearchArticlesTool extends BaseTool({
      title: "Search Articles",
      description: "Search blog articles by keyword",
      inputSchema: z.object({
        keyword: z.string().min(2),
      }),
      outputSchema: z.object({
        titles: z.array(z.string()),
      }),
    }) {
      constructor(private readonly catalog: ArticleCatalogService) {
        super({
          requireApproval: false,
          outputValidation: "strict",
        } satisfies BaseToolOptions<{ keyword: string }, { titles: string[] }>);
      }

      execute(inputData: { keyword: string }) {
        executeSpy(inputData);
        return Promise.resolve({
          titles: this.catalog.findByKeyword(inputData.keyword),
        });
      }
    }

    @Injectable()
    class CustomIdTool extends BaseTool({
      id: "custom-ping-tool",
      description: "Returns a static pong response",
      outputSchema: z.object({ ok: z.boolean() }),
    }) {
      execute() {
        return Promise.resolve({ ok: true });
      }
    }

    @Injectable()
    class ToolBackedAgent extends BaseAgent {
      constructor(
        searchArticlesTool: SearchArticlesTool,
        customIdTool: CustomIdTool,
      ) {
        super({
          name: "Tool Backed Agent",
          instructions: "Use tools to answer questions.",
          model: "openai/gpt-4o-mini",
          tools: {
            searchArticles: searchArticlesTool,
            customPing: customIdTool,
          },
        });
      }
    }

    expectTypeOf<ToolInput<SearchArticlesTool>>().toEqualTypeOf<{
      keyword: string;
    }>();
    expectTypeOf<ToolOutput<SearchArticlesTool>>().toEqualTypeOf<{
      titles: string[];
    }>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticleCatalogService,
        SearchArticlesTool,
        CustomIdTool,
        ToolBackedAgent,
      ],
    }).compile();

    await moduleRef.init();

    try {
      const searchTool = moduleRef.get(SearchArticlesTool);
      const customTool = moduleRef.get(CustomIdTool);
      const agent = moduleRef.get(ToolBackedAgent);

      expect(searchTool).toBeInstanceOf(BaseTool);
      expect(searchTool).toBeInstanceOf(MastraTool);
      expect(MASTRA_TOOL_MARKER in searchTool).toBe(true);
      expect(searchTool.id).toBe("search-articles-tool");
      expect(searchTool.title).toBe("Search Articles");
      expect(searchTool.outputValidation).toBe("strict");
      expect(customTool.id).toBe("custom-ping-tool");

      const validResult = await searchTool.execute({ keyword: "mastra" });
      expect(validResult).toEqual({ titles: ["article:mastra"] });
      expect(executeSpy).toHaveBeenCalledTimes(1);

      const invalidResult = await searchTool.execute({ keyword: "a" });
      expect(isValidationError(invalidResult)).toBe(true);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      const customResult = await customTool.execute();
      expect(customResult).toEqual({ ok: true });

      const agentTools = await agent.listTools();
      expect(agentTools.searchArticles).toBe(searchTool);
      expect(agentTools.customPing).toBe(customTool);
    } finally {
      await moduleRef.close();
    }
  });
});
