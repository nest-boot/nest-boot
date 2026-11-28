import {
  isValidationError,
  MASTRA_TOOL_MARKER,
  Tool as MastraTool,
} from "@mastra/core/tools";
import { z } from "zod";

import type { BaseToolOptions } from "../interfaces/base-tool-options.interface.js";
import { BaseTool } from "./base.tool.js";

describe("BaseTool", () => {
  it("derives kebab-case id, preserves runtime options, binds execute, and validates schemas", async () => {
    const catalog = {
      findByKeyword: (keyword: string) => [`article:${keyword}`],
    };
    const executeSpy = vi.fn();

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
      constructor(private readonly catalogService: typeof catalog) {
        super({
          requireApproval: false,
          outputValidation: "strict",
        } satisfies BaseToolOptions<{ keyword: string }, { titles: string[] }>);
      }

      execute(inputData: { keyword: string }) {
        executeSpy(inputData);
        return Promise.resolve({
          titles: this.catalogService.findByKeyword(inputData.keyword),
        });
      }
    }

    class CustomIdTool extends BaseTool({
      id: "custom-ping-tool",
      description: "Returns a static pong response",
      outputSchema: z.object({ ok: z.boolean() }),
    }) {
      execute() {
        return Promise.resolve({ ok: true });
      }
    }

    const searchTool = new SearchArticlesTool(catalog);
    const customTool = new CustomIdTool();

    expect(searchTool).toBeInstanceOf(BaseTool);
    expect(searchTool).toBeInstanceOf(MastraTool);
    expect({}).not.toBeInstanceOf(BaseTool);
    expect(null).not.toBeInstanceOf(BaseTool);
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

    await expect(customTool.execute()).resolves.toEqual({ ok: true });
  });
});
