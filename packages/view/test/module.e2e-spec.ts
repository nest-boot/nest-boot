import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  Query,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Liquid } from "liquidjs";
import request from "supertest";

import { ViewModule } from "../src/index.js";

@Controller()
class ViewController {
  constructor(private readonly liquid: Liquid) {}

  @Get("render")
  async render(@Query("name") name = "Nest Boot"): Promise<unknown> {
    return await this.liquid.renderFile("page", { name });
  }
}

describe("ViewModule HTTP integration", () => {
  const originalCwd = process.cwd();
  const apps: INestApplication[] = [];
  let workingDirectory: string;

  beforeEach(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), "nest-boot-view-"));
    process.chdir(workingDirectory);
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    process.chdir(originalCwd);
    await rm(workingDirectory, { force: true, recursive: true });
  });

  it("renders layouts and partials with static module defaults", async () => {
    await writeTemplates({
      root: "views",
      partials: "views/partials",
      layouts: "views/layouts",
      extname: ".liquid",
    });
    const app = await createApp(ViewModule);

    await request(app.getHttpServer())
      .get("/render")
      .query({ name: "Static" })
      .expect(200, "<main>Hello, STATIC!</main>");

    await request(app.getHttpServer())
      .get("/render")
      .query({ name: '<img src=x onerror="alert(1)">' })
      .expect(
        200,
        "<main>Hello, &lt;IMG SRC=X ONERROR=&#34;ALERT(1)&#34;&gt;!</main>",
      );
  });

  it("renders with synchronously configured paths", async () => {
    await writeTemplates({
      root: "templates",
      partials: "templates/includes",
      layouts: "templates/layouts",
      extname: ".html",
    });
    const app = await createApp(
      ViewModule.register({
        root: ["templates/"],
        partials: ["templates/includes/"],
        layouts: ["templates/layouts/"],
        extname: ".html",
      }),
    );

    await request(app.getHttpServer())
      .get("/render")
      .query({ name: "Dynamic" })
      .expect(200, "<main>Hello, DYNAMIC!</main>");
  });

  it("renders with asynchronously configured templates", async () => {
    const app = await createApp(
      ViewModule.registerAsync({
        useFactory: () =>
          Promise.resolve({
            templates: {
              "page.liquid":
                '{% layout "base" %}{% block content %}Hello, {% render "name", name: name %}!{% endblock %}',
              "base.liquid":
                "<main>{% block content %}default{% endblock %}</main>",
              "name.liquid": "{{ name | upcase }}",
            },
          }),
      }),
    );

    await request(app.getHttpServer())
      .get("/render")
      .query({ name: "Async" })
      .expect(200, "<main>Hello, ASYNC!</main>");
  });

  async function createApp(
    viewModule: DynamicModule | Type,
  ): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [viewModule],
      controllers: [ViewController],
    }).compile();
    const app = module.createNestApplication();
    apps.push(app);
    await app.init();
    return app;
  }

  async function writeTemplates(options: {
    root: string;
    partials: string;
    layouts: string;
    extname: string;
  }): Promise<void> {
    await Promise.all([
      mkdir(options.root, { recursive: true }),
      mkdir(options.partials, { recursive: true }),
      mkdir(options.layouts, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(options.root, `page${options.extname}`),
        '{% layout "base" %}{% block content %}Hello, {% render "name", name: name %}!{% endblock %}',
      ),
      writeFile(
        join(options.layouts, `base${options.extname}`),
        "<main>{% block content %}default{% endblock %}</main>",
      ),
      writeFile(
        join(options.partials, `name${options.extname}`),
        "{{ name | upcase }}",
      ),
    ]);
  }
});
