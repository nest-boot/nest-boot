import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import type {
  ArgumentMetadata,
  CanActivate,
  ExecutionContext,
  PipeTransform,
  Type,
} from "@nestjs/common";
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

interface RouteArgumentMetadataValue {
  index: number;
  data?: unknown;
  factory?: (data: unknown, context: ExecutionContext) => unknown;
  pipes?: (PipeTransform | Type<PipeTransform>)[];
}
type RouteArgumentMetadata = Record<string, RouteArgumentMetadataValue>;

const ROUTE_ARGS_METADATA = "__routeArguments__";
const CUSTOM_ROUTE_ARGS_METADATA = "__customRouteArgs__";
const PARAMTYPES_METADATA = "design:paramtypes";
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
const HTTP_PIPEABLE_ROUTE_PARAM_TYPES: number[] = [
  ROUTE_PARAM_TYPES.BODY,
  ROUTE_PARAM_TYPES.RAW_BODY,
  ROUTE_PARAM_TYPES.QUERY,
  ROUTE_PARAM_TYPES.PARAM,
  ROUTE_PARAM_TYPES.FILE,
  ROUTE_PARAM_TYPES.FILES,
];

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
    const args = await this.getSubjectFactoryArgs(context);

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

  private async getSubjectFactoryArgs(
    context: ExecutionContext,
  ): Promise<unknown[]> {
    const routeArgsMetadata = this.getRouteArgsMetadata(context);

    if (routeArgsMetadata) {
      return await this.createRouteArguments(context, routeArgsMetadata);
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

  private async createRouteArguments(
    context: ExecutionContext,
    metadata: RouteArgumentMetadata,
  ): Promise<unknown[]> {
    const args: unknown[] = [];

    await Promise.all(
      Object.entries(metadata).map(async ([key, parameterMetadata]) => {
        args[parameterMetadata.index] = await this.resolveRouteArgument(
          context,
          key,
          parameterMetadata,
        );
      }),
    );

    return args;
  }

  private async resolveRouteArgument(
    context: ExecutionContext,
    key: string,
    metadata: RouteArgumentMetadataValue,
  ): Promise<unknown> {
    const value = await this.extractRouteArgument(context, key, metadata);

    return await this.applyRouteArgumentPipes(context, key, metadata, value);
  }

  private extractRouteArgument(
    context: ExecutionContext,
    key: string,
    metadata: RouteArgumentMetadataValue,
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

  private async applyRouteArgumentPipes(
    context: ExecutionContext,
    key: string,
    metadata: RouteArgumentMetadataValue,
    value: unknown,
  ): Promise<unknown> {
    const pipes = metadata.pipes ?? [];

    if (!pipes.length || !this.isRouteArgumentPipeable(context, key)) {
      return value;
    }

    const argumentMetadata = this.createPipeArgumentMetadata(
      context,
      key,
      metadata,
    );

    return await pipes.reduce<Promise<unknown>>(async (deferred, pipe) => {
      const pipeInstance = await this.resolvePipe(pipe, context);
      const pipeValue = await deferred;

      return await pipeInstance.transform(pipeValue, argumentMetadata);
    }, Promise.resolve(value));
  }

  private isRouteArgumentPipeable(
    context: ExecutionContext,
    key: string,
  ): boolean {
    if (context.getType<string>() === "graphql") {
      return true;
    }

    const type = this.getRouteArgumentType(key);

    return (
      typeof type === "string" ||
      (typeof type === "number" &&
        HTTP_PIPEABLE_ROUTE_PARAM_TYPES.includes(type))
    );
  }

  private createPipeArgumentMetadata(
    context: ExecutionContext,
    key: string,
    metadata: RouteArgumentMetadataValue,
  ): ArgumentMetadata {
    return {
      data: this.getStringData(metadata.data) ?? undefined,
      metatype: this.getRouteArgumentMetatype(context, metadata.index),
      type: this.getPipeArgumentType(key),
    };
  }

  private getRouteArgumentMetatype(
    context: ExecutionContext,
    index: number,
  ): Type<unknown> | undefined {
    const methodName = this.getHandlerMethodName(context);

    if (!methodName) {
      return undefined;
    }

    return Reflect.getMetadata(
      PARAMTYPES_METADATA,
      context.getClass().prototype,
      methodName,
    )?.[index] as Type<unknown> | undefined;
  }

  private getPipeArgumentType(key: string): ArgumentMetadata["type"] {
    const type = this.getRouteArgumentType(key);

    switch (type) {
      case ROUTE_PARAM_TYPES.BODY:
        return "body";
      case ROUTE_PARAM_TYPES.PARAM:
        return "param";
      case ROUTE_PARAM_TYPES.QUERY:
        return "query";
      default:
        return "custom";
    }
  }

  private getRouteArgumentType(key: string): string | number {
    const type = key.split(":")[0];

    return key.includes(CUSTOM_ROUTE_ARGS_METADATA) ? type : Number(type);
  }

  private async resolvePipe(
    pipe: PipeTransform | Type<PipeTransform>,
    context: ExecutionContext,
  ): Promise<PipeTransform> {
    if (this.isPipeTransform(pipe)) {
      return pipe;
    }

    return await this.resolveProvider(pipe, context);
  }

  private isPipeTransform(
    pipe: PipeTransform | Type<PipeTransform>,
  ): pipe is PipeTransform {
    return "transform" in pipe && typeof pipe.transform === "function";
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
    switch (context.getType<string>()) {
      case "http":
        return this.getRequiredHttpRequestContext(context);
      case "graphql":
        return this.getRequiredGraphqlRequestContext(context);
      default:
        throw new ForbiddenException(
          "Permission request context is not available",
        );
    }
  }

  private getRequest(context: ExecutionContext): Request | undefined {
    switch (context.getType<string>()) {
      case "http":
        return this.getHttpRequestContext(context)?.req;
      case "graphql":
        return this.getGraphqlContext(context)?.req;
      default:
        return undefined;
    }
  }

  private getRequiredHttpRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext {
    const requestContext = this.getHttpRequestContext(context);

    if (!requestContext) {
      throw new ForbiddenException(
        "Permission request context is not available",
      );
    }

    return requestContext;
  }

  private getRequiredGraphqlRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext {
    const gqlContext = this.getGraphqlContext(context);
    const req = gqlContext?.req;

    if (!req) {
      throw new ForbiddenException(
        "Permission request context is not available",
      );
    }

    return this.createRequestContext(req, gqlContext.res);
  }

  private getHttpRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext | null {
    if (context.getType<string>() === "graphql") {
      return null;
    }

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
