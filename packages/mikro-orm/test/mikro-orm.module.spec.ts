import { DataloaderType, EntityManager, MikroORM } from "@mikro-orm/core";

jest.mock("@mikro-orm/nestjs", () => ({
  MikroOrmModule: {
    clearStorage: jest.fn(),
    forFeature: jest.fn(),
    forMiddleware: jest.fn(),
    forRootAsync: jest.fn(() => ({
      module: class BaseRootModule {},
    })),
  },
}));

import { MikroOrmModule as BaseMikroOrmModule } from "@mikro-orm/nestjs";
import { RequestContext } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";

import { MikroOrmModule } from "../src";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "../src/mikro-orm.module-definition";
import { TestEntity } from "./entities/test.entity";

type RootOptionsFactory = (
  options: Parameters<typeof MikroOrmModule.forRoot>[0],
) => Promise<Record<string, unknown>>;

function getRootOptionsFactory(): RootOptionsFactory {
  const baseModule = jest.mocked(BaseMikroOrmModule);
  const [rootOptions] = baseModule.forRootAsync.mock.calls[0] as unknown as [
    { useFactory: RootOptionsFactory },
  ];

  return rootOptions.useFactory;
}

describe("MikroOrmModule", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should register synchronous options", () => {
    const options = {
      autoLoadEntities: true,
    };
    const dynamicModule = MikroOrmModule.forRoot(options);

    expect(dynamicModule.module).toBe(MikroOrmModule);
    expect(dynamicModule.providers).toEqual(
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
    expect(dynamicModule.providers).toEqual(
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

  it("should merge ambient database config with non-connection options", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://user:pass@ambient.example:5432/ambient";

    try {
      await expect(
        getRootOptionsFactory()({ debug: true }),
      ).resolves.toMatchObject({
        dbName: "ambient",
        debug: true,
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
    jest
      .spyOn(BaseMikroOrmModule, "forFeature")
      .mockReturnValue(featureModule as never);
    jest
      .spyOn(BaseMikroOrmModule, "forMiddleware")
      .mockReturnValue(middlewareModule as never);
    const clearStorage = jest
      .spyOn(BaseMikroOrmModule, "clearStorage")
      .mockReturnValue();

    expect(MikroOrmModule.forFeature([TestEntity])).toBe(featureModule);
    expect(MikroOrmModule.forMiddleware()).toBe(middlewareModule);
    MikroOrmModule.clearStorage();
    expect(clearStorage).toHaveBeenCalledTimes(1);
  });

  it("should register request context middleware that forks the entity manager", async () => {
    const forkedEm = {} as EntityManager;
    const fork = jest.fn(() => forkedEm);
    const orm = {
      em: {
        fork,
      },
    } as unknown as MikroORM;
    const registerMiddleware = jest
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
      set: jest.fn(),
    };
    const next = jest.fn(async () => {
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
