import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import type { CanActivate, ExecutionContext, Type } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ContextIdFactory, ModuleRef, Reflector } from "@nestjs/core";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { Session } from "./entities/session.entity.js";
import { RequestIdentity } from "./infrastructure/request-identity.js";
import type { CanMetadata } from "./interfaces/can-metadata.interface.js";
import type { RouteArgumentMetadataValue } from "./interfaces/route-argument-metadata-value.interface.js";
import {
  CAN_METADATA,
  CUSTOM_ROUTE_ARGS_METADATA,
  GQL_PARAM_TYPES,
  ROUTE_ARGS_METADATA,
  ROUTE_PARAM_TYPES,
} from "./permission.constants.js";
import { AccessControlService } from "./services/access-control.service.js";
import type { CanSubjectFactory } from "./types/can-subject-factory.type.js";
import type { RouteArgumentMetadata } from "./types/route-argument-metadata.type.js";
import { getCurrentApiKey } from "./utils/get-current-api-key.util.js";

/** Guard that enforces authentication and evaluates route permissions. */
@Injectable()
export class AuthGuard implements CanActivate {
  /** Rebuilds the ability after an explicit sign-in changes the request identity. */
  refreshAbility(): void {
    RequestIdentity.refresh(this.options);
  }
  /**
   * Creates the authentication and permission guard.
   *
   * @param reflector - Nest metadata reflector.
   * @param options - Auth module options.
   * @param moduleRef - Nest module reference used to resolve handler instances.
   * @param accessControlService - Shared fail-closed operation authorization.
   */
  constructor(
    protected readonly reflector: Reflector,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly moduleRef: ModuleRef,
    private readonly accessControlService: AccessControlService,
  ) {}

  /**
   * Determines whether the current route is marked as public.
   *
   * @param context - Current Nest execution context.
   * @returns `true` when session authentication should be skipped.
   */
  protected isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  /**
   * Determines whether the request has an authenticated session.
   *
   * @returns `true` when the request is authenticated.
   */
  protected isAuthenticated(): boolean {
    try {
      return !!RequestContext.get(Session) || !!getCurrentApiKey();
    } catch {
      return false;
    }
  }

  /**
   * Checks authentication and route permission metadata.
   *
   * @param context - Current Nest execution context.
   * @returns `true` when access is allowed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = this.isAuthenticated();
    if (!this.isPublic(context) && !authenticated) {
      throw new UnauthorizedException("Authentication is required");
    }

    if (RequestContext.isActive()) {
      RequestContext.set(AccessControlService, this.accessControlService);
      RequestIdentity.prepare(this.options);
    }

    const metadata = this.reflector.getAllAndMerge<CanMetadata[]>(
      CAN_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata?.length) return true;
    for (const requirement of metadata) {
      if (!this.accessControlService.getAbility()) return false;
      const subject = await this.resolveSubject(requirement, context);
      if (!this.accessControlService.can(requirement.action, subject))
        return false;
    }
    return true;
  }

  private async resolveSubject(
    canOptions: CanMetadata,
    context: ExecutionContext,
  ): Promise<Subject> {
    const { subject } = canOptions;

    if (this.isSubjectType(subject)) {
      return subject;
    }

    return await this.resolveSubjectFactory(subject, context);
  }

  private isSubjectType(
    subject: CanMetadata["subject"],
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

  private getRequest(context: ExecutionContext): Request | undefined {
    switch (context.getType<string>()) {
      case "http":
        return context.switchToHttp().getRequest<Request | undefined>();
      case "graphql":
        return (context.getArgs()[2] as { req?: Request } | undefined)?.req;
      default:
        return undefined;
    }
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
        args[parameterMetadata.index] = await this.extractRouteArgument(
          context,
          key,
          parameterMetadata,
        );
      }),
    );

    return args;
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
}
