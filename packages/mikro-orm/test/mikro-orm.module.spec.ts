import { DataloaderType, EntityManager, MikroORM } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";

vi.mock("@mikro-orm/nestjs", () => ({
  MikroOrmModule: {
    clearStorage: vi.fn(),
    forFeature: vi.fn(),
    forMiddleware: vi.fn(),
    forRootAsync: vi.fn(() => ({
      module: class BaseRootModule {},
    })),
  },
}));

import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import { RequestContext } from "@nest-boot/request-context";
import type { DynamicModule } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MikroOrmModule } from "../src/index.js";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "../src/mikro-orm.module-definition.js";
import { TestEntity } from "./entities/test.entity.js";

type RootOptionsFactory = (
  options: Parameters<typeof MikroOrmModule.forRoot>[0],
) => Promise<Record<string, unknown>>;

function getRootOptionsFactory(): RootOptionsFactory {
  const baseModule = vi.mocked(BaseMikroOrmModule);
  const [rootOptions] = baseModule.forRootAsync.mock.calls[0] as unknown as [
    { useFactory: RootOptionsFactory },
  ];

  return rootOptions.useFactory;
}

function getOptionsModule(dynamicModule: DynamicModule): DynamicModule {
  return dynamicModule.imports?.[0] as DynamicModule;
}

describe("MikroOrmModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register synchronous options", () => {
    const options = {
      autoLoadEntities: true,
    };
    const dynamicModule = MikroOrmModule.forRoot(options);

    expect(dynamicModule.module).toBe(MikroOrmModule);
    expect(getOptionsModule(dynamicModule).providers).toEqual(
      expect.arrayContaining([
        {
          provide: BASE_MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
  });

  it("should register asynchronous options", () => {
    const useFactory = () => ({
      autoLoadEntities: true,
    });
    const dynamicModule = MikroOrmModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(MikroOrmModule);
    expect(getOptionsModule(dynamicModule).providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: BASE_MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("should not merge ambient database config into explicit connection options", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mongodb://ambient.example/ambient";

    try {
      const options = {
        clientUrl: "postgresql://explicit.example/explicit",
      };
      const config = await getRootOptionsFactory()(options);

      expect(config).toMatchObject({
        clientUrl: "postgresql://explicit.example/explicit",
      });

      expect(config).not.toHaveProperty("host");
      expect(config).not.toHaveProperty("dbName");
      expect(config).toMatchObject({
        dataloader: DataloaderType.ALL,
        entities: ["dist/**/*.entity.js"],
        entitiesTs: ["src/**/*.entity.ts"],
      });
    } finally {
      if (databaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = databaseUrl;
      }
    }
  });

  it("should use explicit runtime entities for TypeScript discovery", async () => {
    await expect(
      getRootOptionsFactory()({
        dbName: ":memory:",
        entities: [TestEntity],
      }),
    ).resolves.toMatchObject({
      entities: [TestEntity],
      entitiesTs: [TestEntity],
    });
  });

  it("should merge ambient database config with non-connection options", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://user:pass@ambient.example:5432/ambient";

    try {
      await expect(
        getRootOptionsFactory()({
          debug: true,
          driver: PostgreSqlDriver,
        }),
      ).resolves.toMatchObject({
        dbName: "ambient",
        debug: true,
        driver: PostgreSqlDriver,
        host: "ambient.example",
        password: "pass",
        port: 5432,
        user: "user",
      });
    } finally {
      if (databaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = databaseUrl;
      }
    }
  });

  it("should delegate feature and middleware registration to the base module", () => {
    const featureModule = {
      module: class FeatureModule {},
    };
    const middlewareModule = {
      module: class MiddlewareModule {},
    };
    vi.spyOn(BaseMikroOrmModule, "forFeature").mockReturnValue(
      featureModule as never,
    );
    vi.spyOn(BaseMikroOrmModule, "forMiddleware").mockReturnValue(
      middlewareModule as never,
    );
    const clearStorage = vi
      .spyOn(BaseMikroOrmModule, "clearStorage")
      .mockReturnValue();

    expect(MikroOrmModule.forFeature([TestEntity])).toBe(featureModule);
    expect(MikroOrmModule.forMiddleware()).toBe(middlewareModule);
    MikroOrmModule.clearStorage();
    expect(clearStorage).toHaveBeenCalledTimes(1);
  });

  it("should register request context middleware that forks the entity manager", async () => {
    const forkedEm = {} as EntityManager;
    const fork = vi.fn(() => forkedEm);
    const orm = {
      em: {
        fork,
      },
    } as unknown as MikroORM;
    const registerMiddleware = vi
      .spyOn(RequestContext, "registerMiddleware")
      .mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        MikroOrmModule,
        {
          provide: MikroORM,
          useValue: orm,
        },
      ],
    }).compile();
    const module = moduleRef.get(MikroOrmModule);

    module.onModuleInit();

    expect(registerMiddleware).toHaveBeenCalledWith(
      "mikro-orm",
      expect.any(Function),
    );

    const middleware = registerMiddleware.mock.calls[0][1];
    const ctx = {
      set: vi.fn(),
    };
    const next = vi.fn(async () => {
      await Promise.resolve();
      return "next-result";
    });

    await expect(middleware(ctx as never, next)).resolves.toBe("next-result");
    expect(fork).toHaveBeenCalledWith({
      useContext: true,
    });
    expect(ctx.set).toHaveBeenCalledWith(EntityManager, forkedEm);
  });

  it("should provide empty options when base options are missing", () => {
    const providers = Reflect.getMetadata("providers", MikroOrmModule) as any[];
    const optionsProvider = providers.find(
      (provider) => provider.provide === MODULE_OPTIONS_TOKEN,
    );

    expect(optionsProvider.useFactory(undefined)).toEqual({});
    expect(
      optionsProvider.useFactory({
        autoLoadEntities: true,
      }),
    ).toEqual({
      autoLoadEntities: true,
    });
  });
});
