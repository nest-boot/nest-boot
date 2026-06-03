import { EntityManager, MikroORM } from "@mikro-orm/core";

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

import { MikroOrmModule } from "../src";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "../src/mikro-orm.module-definition";
import { TestEntity } from "./entities/test.entity";

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
    const module = new MikroOrmModule(orm);

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
