import { RequestContext } from "@nest-boot/request-context";
import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { i18n } from "i18next";
import request from "supertest";

import { I18N, I18nModule, InjectI18n, translation } from "../src/index.js";

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

describe("I18nModule - e2e", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("detects the request language and exposes it through RequestContext", async () => {
    const app = await createApp(I18nModule.register(createOptions()));

    const response = await request(app.getHttpServer())
      .get("/translations")
      .set("accept-language", "de")
      .expect(200);

    expect(response.body).toEqual({
      injected: "Hello",
      language: "de",
      requestScoped: "Hallo",
    });
  });

  it("initializes an asynchronously registered module", async () => {
    const useFactory = vi.fn(() => Promise.resolve(createOptions()));
    const app = await createApp(I18nModule.registerAsync({ useFactory }));

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

  async function createApp(
    i18nModule: DynamicModule | Type,
  ): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [TranslationController],
      imports: [i18nModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    apps.push(app);
    await app.init();

    return app;
  }
});

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
