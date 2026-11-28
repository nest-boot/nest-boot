import {
  BaseAgent,
  BaseStep,
  BaseTool,
  BaseWorkflow,
  DEFAULT_MASTRA_SERVER_PREFIX,
  MASTRA_MODULE_OPTIONS,
  MastraController,
  MastraManager,
  MastraModule,
  normalizeMastraServerOptions,
  normalizeMastraStudioOptions,
  resolveMastraServerPrefix,
  resolveMastraStudioBasePath,
} from "./index.js";

describe("index exports", () => {
  it("re-exports all public Mastra runtime symbols", () => {
    expect(BaseAgent).toBeDefined();
    expect(BaseStep).toBeDefined();
    expect(BaseTool).toBeDefined();
    expect(BaseWorkflow).toBeDefined();
    expect(DEFAULT_MASTRA_SERVER_PREFIX).toBe("/api/mastra");
    expect(MASTRA_MODULE_OPTIONS).toBeDefined();
    expect(MastraController).toBeDefined();
    expect(MastraManager).toBeDefined();
    expect(MastraModule).toBeDefined();
    expect(normalizeMastraServerOptions).toBeTypeOf("function");
    expect(normalizeMastraStudioOptions).toBeTypeOf("function");
    expect(resolveMastraServerPrefix).toBeTypeOf("function");
    expect(resolveMastraStudioBasePath).toBeTypeOf("function");
  });
});
