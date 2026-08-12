import { stat } from "node:fs/promises";

import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { TemporaryDirectoryModule, TemporaryDirectoryService } from "../src";

@Controller("temporary-directory")
class TemporaryDirectoryController {
  constructor(
    private readonly temporaryDirectoryService: TemporaryDirectoryService,
  ) {}

  @Get()
  async create(): Promise<{ path: string }> {
    const path = await this.temporaryDirectoryService.create();
    await stat(path);
    return { path };
  }
}

describe("TemporaryDirectoryModule HTTP integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TemporaryDirectoryModule],
      controllers: [TemporaryDirectoryController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps a created directory through the request and removes it afterward", async () => {
    const response = await request(app.getHttpServer())
      .get("/temporary-directory")
      .expect(200);
    const { path } = response.body as { path: string };

    expect(path).toEqual(expect.any(String));
    await expectRemoval(path);
  });
});

async function expectRemoval(path: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await stat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  throw new Error(`Temporary directory was not removed: ${path}`);
}
