import {
  type CanActivate,
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  Controller,
  type DynamicModule,
  type ExecutionContext,
  Get,
  type INestApplication,
  Inject,
  Injectable,
  Module,
  UseGuards,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";

import {
  createDynamicController,
  IS_PUBLIC_KEY,
  Public,
  withDynamicController,
} from "../../src/index.js";

const TENANT_NAME = Symbol("TENANT_NAME");

interface WebhookOptions {
  tenant: string;
  path?: string;
  decorators?: ClassDecorator[];
}

@Injectable()
class TenantHeaderGuard implements CanActivate {
  constructor(@Inject(TENANT_NAME) private readonly tenant: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    return req.headers["x-tenant"] === this.tenant;
  }
}

@Injectable()
class PublicGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

@Controller()
class WebhookController {
  constructor(@Inject(TENANT_NAME) private readonly tenant: string) {}

  @Get("ping")
  ping(): { tenant: string } {
    return { tenant: this.tenant };
  }
}

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<WebhookOptions>().build();

@Module({
  providers: [
    {
      provide: TENANT_NAME,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: WebhookOptions) => options.tenant,
    },
  ],
})
class WebhookModule extends ConfigurableModuleClass {
  static override register(options: WebhookOptions): DynamicModule {
    return withDynamicController(super.register(options), WebhookController, {
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (resolved: WebhookOptions) => ({
        path: resolved.path,
        decorators: resolved.decorators,
      }),
    });
  }

  static override registerAsync(
    options: ConfigurableModuleAsyncOptions<WebhookOptions>,
  ): DynamicModule {
    return withDynamicController(
      super.registerAsync(options),
      WebhookController,
      {
        inject: [MODULE_OPTIONS_TOKEN],
        useFactory: async (resolved: WebhookOptions) =>
          await Promise.resolve({
            path: resolved.path,
            decorators: resolved.decorators,
          }),
      },
    );
  }
}

describe("dynamic controller helpers", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("isolates multiple registrations of the same controller across sync and async modules", async () => {
    const { controller: rootController, provider: rootProvider } =
      createDynamicController(WebhookController, {
        useFactory: () => ({ decorators: [Public()] }),
      });

    @Module({
      controllers: [rootController],
      providers: [{ provide: TENANT_NAME, useValue: "root" }, rootProvider],
    })
    class RootWebhookModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        RootWebhookModule,
        WebhookModule.register({
          tenant: "alpha",
          path: "/webhooks/alpha",
          decorators: [Public(), UseGuards(TenantHeaderGuard)],
        }),
        WebhookModule.registerAsync({
          useFactory: () =>
            Promise.resolve({
              tenant: "beta",
              path: "/webhooks/beta",
              decorators: [Public()],
            }),
        }),
      ],
      providers: [{ provide: APP_GUARD, useClass: PublicGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();

    const rootRes = await fetch(`${url}/ping`);
    expect(rootRes.status).toBe(200);
    expect(await rootRes.json()).toEqual({ tenant: "root" });

    expect((await fetch(`${url}/webhooks/alpha/ping`)).status).toBe(403);
    const alphaRes = await fetch(`${url}/webhooks/alpha/ping`, {
      headers: { "x-tenant": "alpha" },
    });
    expect(alphaRes.status).toBe(200);
    expect(await alphaRes.json()).toEqual({ tenant: "alpha" });

    const betaRes = await fetch(`${url}/webhooks/beta/ping`);
    expect(betaRes.status).toBe(200);
    expect(await betaRes.json()).toEqual({ tenant: "beta" });
  });
});
