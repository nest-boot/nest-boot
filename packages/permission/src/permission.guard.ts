import type { Subject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import type { CanActivate, ExecutionContext, Type } from "@nestjs/common";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
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

  private async resolveSubjectFactory(
    subjectFactory: CanSubjectFactory,
    context: ExecutionContext,
  ): Promise<Subject> {
    const handlerSelf = this.moduleRef.get(context.getClass(), {
      strict: false,
    });
    const args = context.getArgs();

    return await subjectFactory(handlerSelf, ...args);
  }

  private getRequestContext(
    context: ExecutionContext,
  ): PermissionRequestContext {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request | undefined>();
    const res = httpContext.getResponse<Response | undefined>();

    if (req?.headers && res) {
      return { req, res };
    }

    const gqlContext = context.getArgs()[2] as
      | PermissionRequestContext
      | undefined;

    if (!gqlContext?.req || !gqlContext.res) {
      throw new ForbiddenException(
        "Permission request context is not available",
      );
    }

    return gqlContext;
  }
}
