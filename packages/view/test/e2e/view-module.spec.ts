import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Liquid } from "liquidjs";

import { ViewModule } from "../../src/view.module.js";

@Injectable()
class LiquidConsumer {
  constructor(readonly liquid: Liquid) {}
}

@Module({ providers: [LiquidConsumer] })
class FeatureModule {}

describe("ViewModule", () => {
  const modules: TestingModule[] = [];
  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
  });
  it("provides Liquid with the default file-system options", async () => {
    const module = await compile(ViewModule);
    const liquid = module.get(Liquid);
    expect(liquid).toBeInstanceOf(Liquid);
    expect(liquid.options).toMatchObject({
      root: ["views/"],
      partials: ["views/partials/"],
      layouts: ["views/layouts/"],
      extname: ".liquid",
      outputEscape: expect.any(Function),
    });
    await expect(
      liquid.parseAndRender("Hello, {{ name | upcase }}!", {
        name: "Nest Boot",
      }),
    ).resolves.toBe("Hello, NEST BOOT!");
  });
  it("escapes output by default and supports explicit raw output", async () => {
    const module = await compile(ViewModule);
    const liquid = module.get(Liquid);
    const html = '<img src=x onerror="alert(1)">';
    await expect(liquid.parseAndRender("{{ html }}", { html })).resolves.toBe(
      "&lt;img src=x onerror=&#34;alert(1)&#34;&gt;",
    );
    await expect(
      liquid.parseAndRender("{{ html | raw }}", { html }),
    ).resolves.toBe(html);
  });
  it("creates Liquid with synchronous registration options", async () => {
    const module = await compile(
      ViewModule.forRoot({
        root: ["templates/"],
        partials: ["templates/includes/"],
        layouts: ["templates/layouts/"],
        extname: ".html",
        strictVariables: true,
      }),
    );
    const liquid = module.get(Liquid);
    expect(liquid.options).toMatchObject({
      root: ["templates/"],
      partials: ["templates/includes/"],
      layouts: ["templates/layouts/"],
      extname: ".html",
      strictVariables: true,
    });
  });
  it("creates Liquid with asynchronous registration options", async () => {
    const useFactory = vi.fn(() =>
      Promise.resolve({
        cache: true,
        extname: ".template",
        globals: { product: "Nest Boot" },
      }),
    );
    const module = await compile(ViewModule.forRootAsync({ useFactory }));
    const liquid = module.get(Liquid);
    expect(useFactory).toHaveBeenCalledOnce();
    expect(liquid.options).toMatchObject({
      root: ["views/"],
      partials: ["views/partials/"],
      layouts: ["views/layouts/"],
      extname: ".template",
      globals: { product: "Nest Boot" },
    });
    expect(liquid.options.cache).toBeDefined();
  });
  it.each(["direct", "sync", "async"] as const)(
    "globally exports Liquid to feature modules (%s registration)",
    async (mode) => {
      const viewModule =
        mode === "sync"
          ? ViewModule.forRoot({ extname: ".html" })
          : mode === "async"
            ? ViewModule.forRootAsync({
                useFactory: () => ({ extname: ".tpl" }),
              })
            : ViewModule;
      const module = await Test.createTestingModule({
        imports: [viewModule, FeatureModule],
      }).compile();
      modules.push(module);
      expect(module.get(LiquidConsumer).liquid).toBe(module.get(Liquid));
    },
  );
  /**
   * Returns compiled Nest testing module.
   * @param viewModule - View module registration to test.
   * @returns Compiled Nest testing module.
   */
  async function compile(
    viewModule: typeof ViewModule | ReturnType<typeof ViewModule.forRoot>,
  ): Promise<TestingModule> {
    const module = await Test.createTestingModule({
      imports: [viewModule],
    }).compile();
    modules.push(module);
    return module;
  }
});
