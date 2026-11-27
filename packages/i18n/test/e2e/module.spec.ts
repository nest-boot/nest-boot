import { RequestContext } from "@nest-boot/request-context";
import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  Module,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { i18n } from "i18next";
import request from "supertest";

import { I18N, I18nModule, InjectI18n, translation } from "../../src/index.js";

@Controller("translations")
class TranslationController {
  constructor(@InjectI18n() private readonly i18n: i18n) {}

  @Get()
  translate(): TranslationResponse {
    return {
      injected: this.i18n.t("greeting"),
      language: RequestContext.get<i18n>(I18N)?.language,
      requestScoped: translation("greeting"),
    };
  }
}

interface TranslationResponse {
  injected: string;
  language?: string;
  requestScoped: string;
}

@Module({
  controllers: [TranslationController],
})
class FeatureModule {}

describe("I18nModule - e2e", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("isolates bare I18nModule from resources configured by an earlier or concurrent application", async () => {
    const configuredApp = await createApp(I18nModule.forRoot(createOptions()));
    const defaultApp = await createApp(I18nModule);

    const configuredResponse = await request(configuredApp.getHttpServer())
      .get("/translations")
      .set("accept-language", "de")
      .expect(200);
    const defaultGermanResponse = await request(defaultApp.getHttpServer())
      .get("/translations")
      .set("accept-language", "de")
      .expect(200);
    const defaultFallbackResponse = await request(defaultApp.getHttpServer())
      .get("/translations")
      .expect(200);

    expect(configuredResponse.body).toEqual({
      injected: "Hello",
      language: "de",
      requestScoped: "Hallo",
    });
    expect(defaultGermanResponse.body).toEqual({
      injected: "greeting",
      language: "de",
      requestScoped: "greeting",
    });
    expect(defaultFallbackResponse.body).toEqual({
      injected: "greeting",
      language: "en",
      requestScoped: "greeting",
    });
  });

  it("initializes an asynchronously registered module", async () => {
    const useFactory = vi.fn(() => Promise.resolve(createOptions()));
    const app = await createApp(I18nModule.forRootAsync({ useFactory }));

    const response = await request(app.getHttpServer())
      .get("/translations")
      .expect(200);

    expect(useFactory).toHaveBeenCalledOnce();
    expect(response.body).toEqual({
      injected: "Hello",
      language: "en",
      requestScoped: "Hello",
    });
  });

  /**
   * Returns initialized test application and its exposed dependencies.
   * @param i18nModule - Internationalization module registration to test.
   * @returns Initialized test application and its exposed dependencies.
   */
  async function createApp(
    i18nModule: DynamicModule | Type,
  ): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [i18nModule, FeatureModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    apps.push(app);
    await app.init();

    return app;
  }
});

/**
 * Returns options configured for the test.
 * @returns Options configured for the test.
 */
function createOptions() {
  return {
    detection: {
      caches: [],
      order: ["header"],
    },
    fallbackLng: "en",
    lng: "en",
    resources: {
      de: { translation: { greeting: "Hallo" } },
      en: { translation: { greeting: "Hello" } },
    },
  };
}
