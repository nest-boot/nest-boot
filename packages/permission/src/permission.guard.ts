import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import type { CanActivate, ExecutionContext, Type } from "@nestjs/common";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ContextIdFactory, ModuleRef, Reflector } from "@nestjs/core";
import type { Request, Response } from "express";

import type { CanOptions, CanSubjectFactory } from "./decorators/can.decorator";
import { CAN_METADATA } from "./decorators/can.decorator";
import type {
  PermissionModuleOptions,
  PermissionRequestContext,
} from "./interfaces/permission-module-options.interface";
import {
  PERMISSION_ABILITY,
  PERMISSION_ABILITY_PROMISE,
} from "./permission.constants";
import { MODULE_OPTIONS_TOKEN } from "./permission.module-definition";
import type { PermissionAbility } from "./types/permission-ability.type";

type RouteArgumentMetadata = Record<
  string,
  {
    index: number;
    data?: unknown;
    factory?: (data: unknown, context: ExecutionContext) => unknown;
  }
>;

const ROUTE_ARGS_METADATA = "__routeArguments__";
const CUSTOM_ROUTE_ARGS_METADATA = "__customRouteArgs__";
const GQL_PARAM_TYPES = {
  ROOT: 0,
  CONTEXT: 1,
  INFO: 2,
  ARGS: 3,
} as const;
const ROUTE_PARAM_TYPES = {
  REQUEST: 0,
  RESPONSE: 1,
  NEXT: 2,
  BODY: 3,
  QUERY: 4,
  PARAM: 5,
  HEADERS: 6,
  SESSION: 7,
  FILE: 8,
  FILES: 9,
  HOST: 10,
  IP: 11,
  RAW_BODY: 12,
} as const;

/** Guard that evaluates CASL permissions from `Can` metadata. */
@Injectable()
export class PermissionGuard implements CanActivate {
  /**
   * Creates the permission guard.
   *
   * @param reflector - Nest metadata reflector.
   * @param options - Permission module options.
   */
  constructor(
    /** Nest metadata reflector. */
    private readonly reflector: Reflector,
    @Inject(MODULE_OPTIONS_TOKEN)
    /** Permission module options. */
    private readonly options: PermissionModuleOptions,
    /** Nest module reference used to resolve the current handler instance. */
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Checks whether the current request satisfies the route permission metadata.
   *
   * @param context - Current Nest execution context.
   * @returns `true` when access is allowed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canOptions = this.reflector.getAllAndOverride<CanOptions>(
      CAN_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!canOptions) {
      return true;
    }

    const ability = await this.getOrBuildAbility(context);

    if (!ability) {
      throw new ForbiddenException("Permission ability is not available");
    }

    return ability.can(
      canOptions.action,
      await this.resolveSubject(canOptions, context),
    );
  }

  private getOrBuildAbility(
    context: ExecutionContext,
  ): Promise<PermissionAbility | null> {
    const cachedAbility = this.getCachedAbility();

    if (cachedAbility) {
      return Promise.resolve(cachedAbility);
    }

    const cachedAbilityPromise = this.getCachedAbilityPromise();

    if (cachedAbilityPromise) {
      return cachedAbilityPromise;
    }

    return this.buildAndCacheAbility(context);
  }

  private getCachedAbility(): PermissionAbility | null {
    return (
      RequestContext.get<PermissionAbility | null>(PERMISSION_ABILITY) ?? null
    );
  }

  private getCachedAbilityPromise(): Promise<PermissionAbility | null> | null {
    return (
      RequestContext.get<Promise<PermissionAbility | null>>(
        PERMISSION_ABILITY_PROMISE,
      ) ?? null
    );
  }

  private buildAndCacheAbility(
    context: ExecutionContext,
  ): Promise<PermissionAbility | null> {
    const abilityPromise = Promise.resolve()
      .then(() => this.options.buildAbility(this.getRequestContext(context)))
      .then((ability) => {
        RequestContext.set(PERMISSION_ABILITY, ability);
        return ability;
      });

    RequestContext.set(PERMISSION_ABILITY_PROMISE, abilityPromise);
    return abilityPromise;
  }

  private async resolveSubject(
    canOptions: CanOptions,
    context: ExecutionContext,
  ): Promise<Subject> {
    const { subject } = canOptions;

    if (this.isSubjectType(subject)) {
      return subject;
    }

    return await this.resolveSubjectFactory(subject, context);
  }

  private isSubjectType(
    subject: CanOptions["subject"],
  ): subject is Type<Subject> {
    return Function.prototype.toString.call(subject).startsWith("class ");
  }

  private async resolveProvider<T>(
    provider: Type<T>,
    context: ExecutionContext,
  ): Promise<T> {
    return await this.moduleRef.resolve(provider, this.getContextId(context), {
      strict: false,
    });
  }

  private async resolveSubjectFactory(
    subjectFactory: CanSubjectFactory,
    context: ExecutionContext,
  ): Promise<Subject> {
    const handlerSelf = await this.resolveHandlerSelf(context);
    const args = this.getSubjectFactoryArgs(context);

    return await subjectFactory(handlerSelf, ...args);
  }

  private async resolveHandlerSelf(
    context: ExecutionContext,
  ): Promise<unknown> {
    return await this.resolveProvider(context.getClass(), context);
  }

  private getContextId(context: ExecutionContext): { id: number } | undefined {
    const request = this.getRequest(context);

    return request ? ContextIdFactory.getByRequest(request) : undefined;
  }

  private getSubjectFactoryArgs(context: ExecutionContext): unknown[] {
    const routeArgsMetadata = this.getRouteArgsMetadata(context);

    if (routeArgsMetadata) {
      return this.createRouteArguments(context, routeArgsMetadata);
    }

    return [];
  }

  private getRouteArgsMetadata(
    context: ExecutionContext,
  ): RouteArgumentMetadata | null {
    const methodName = this.getHandlerMethodName(context);

    if (!methodName) {
      return null;
    }

    return (
      Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        context.getClass(),
        methodName,
      ) ?? null
    );
  }

  private getHandlerMethodName(
    context: ExecutionContext,
  ): string | symbol | null {
    const handler = context.getHandler();

    if (handler.name) {
      return handler.name;
    }

    const handlerName = Object.getOwnPropertyNames(
      context.getClass().prototype,
    ).find(
      (propertyName) => context.getClass().prototype[propertyName] === handler,
    );

    return handlerName ?? null;
  }

  private createRouteArguments(
    context: ExecutionContext,
    metadata: RouteArgumentMetadata,
  ): unknown[] {
    return Object.entries(metadata).reduce<unknown[]>(
      (args, [key, parameterMetadata]) => {
        args[parameterMetadata.index] = this.resolveRouteArgument(
          context,
          key,
          parameterMetadata,
        );

        return args;
      },
      [],
    );
  }

  private resolveRouteArgument(
    context: ExecutionContext,
    key: string,
    metadata: RouteArgumentMetadata[string],
  ): unknown {
    if (key.includes(CUSTOM_ROUTE_ARGS_METADATA) && metadata.factory) {
      return metadata.factory(metadata.data, context);
    }

    const type = Number(key.split(":")[0]);

    if (context.getType<string>() === "graphql") {
      return this.resolveGraphqlRouteArgument(context, type, metadata.data);
    }

    return this.resolveHttpRouteArgument(context, type, metadata.data);
  }

  private resolveGraphqlRouteArgument(
    context: ExecutionContext,
    type: number,
    data: unknown,
  ): unknown {
    const args = context.getArgs();

    switch (type) {
      case GQL_PARAM_TYPES.ROOT:
        return args[0];
      case GQL_PARAM_TYPES.ARGS:
        return this.getObjectValue(args[1], data);
      case GQL_PARAM_TYPES.CONTEXT:
        return this.getObjectValue(args[2], data);
      case GQL_PARAM_TYPES.INFO:
        return args[3];
      default:
        return undefined;
    }
  }

  private resolveHttpRouteArgument(
    context: ExecutionContext,
    type: number,
    data: unknown,
  ): unknown {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest();
    const res = httpContext.getResponse();
    const next = httpContext.getNext();

    switch (type) {
      case ROUTE_PARAM_TYPES.REQUEST:
        return req;
      case ROUTE_PARAM_TYPES.RESPONSE:
        return res;
      case ROUTE_PARAM_TYPES.NEXT:
        return next;
      case ROUTE_PARAM_TYPES.BODY:
        return this.getObjectValue(this.getRecord(req).body, data);
      case ROUTE_PARAM_TYPES.RAW_BODY:
        return this.getRecord(req).rawBody;
      case ROUTE_PARAM_TYPES.PARAM:
        return this.getObjectValue(this.getRecord(req).params, data);
      case ROUTE_PARAM_TYPES.HOST:
        return this.getObjectValue(this.getRecord(req).hosts, data);
      case ROUTE_PARAM_TYPES.QUERY:
        return this.getObjectValue(this.getRecord(req).query, data);
      case ROUTE_PARAM_TYPES.HEADERS:
        return this.getObjectValue(this.getRecord(req).headers, data, true);
      case ROUTE_PARAM_TYPES.SESSION:
        return this.getRecord(req).session;
      case ROUTE_PARAM_TYPES.FILE:
        return this.getRecord(req)[this.getStringData(data) ?? "file"];
      case ROUTE_PARAM_TYPES.FILES:
        return this.getRecord(req).files;
      case ROUTE_PARAM_TYPES.IP:
        return this.getRecord(req).ip;
      default:
        return undefined;
    }
  }

  private getObjectValue(
    value: unknown,
    data: unknown,
    normalizeKey = false,
  ): unknown {
    const record = this.getRecord(value);
    const key = this.getStringData(data);

    if (!key) {
      return value;
    }

    return record[normalizeKey ? key.toLowerCase() : key];
  }

  private getStringData(data: unknown): string | null {
    return typeof data === "string" ? data : null;
  }

  private getRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  }

  private getRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext {
    const requestContext = this.getHttpRequestContext(context);

    if (requestContext) {
      return requestContext;
    }

    const gqlContext = this.getGraphqlContext(context);
    const req = gqlContext?.req;

    if (!req) {
      throw new ForbiddenException(
        "Permission request context is not available",
      );
    }

    return this.createRequestContext(req, gqlContext.res);
  }

  private getRequest(context: ExecutionContext): Request | undefined {
    return (
      this.getHttpRequestContext(context)?.req ??
      this.getGraphqlContext(context)?.req
    );
  }

  private getHttpRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext | null {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request | undefined>();
    const res = httpContext.getResponse<Response | undefined>();

    if (!req?.headers) {
      return null;
    }

    return this.createRequestContext(req, res);
  }

  private getGraphqlContext(
    context: ExecutionContext,
  ): Partial<PermissionRequestContext> | undefined {
    return context.getArgs()[2] as
      | Partial<PermissionRequestContext>
      | undefined;
  }

  private createRequestContext(
    req: Request,
    res: Response | undefined,
  ): PermissionRequestContext {
    const requestContext: PermissionRequestContext = {
      req,
    };
    const response = res ?? req.res;

    if (response) {
      requestContext.res = response;
    }

    return requestContext;
  }
}
