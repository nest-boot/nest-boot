import { EntityManager } from "@mikro-orm/core";
import { BaseUser } from "@nest-boot/auth";
import { RequestContext } from "@nest-boot/request-context";
import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { AuthRlsService } from "./auth-rls.service";

/**
 * Middleware that applies PostgreSQL row-level security context to each request.
 *
 * @remarks
 * Retrieves the authenticated user from the request context and delegates
 * to {@link AuthRlsService} to set the appropriate RLS role and config variables.
 */
@Injectable()
export class AuthRlsMiddleware implements NestMiddleware {
  /**
   * Creates a new AuthRlsMiddleware instance.
   * @param em - MikroORM entity manager
   * @param authRlsService - Service for applying RLS context
   */
  constructor(
    private readonly em: EntityManager,
    protected readonly authRlsService: AuthRlsService,
  ) {}

  /**
   * Sets the RLS context on the current database transaction.
   * @param _req - Express request object
   * @param _res - Express response object
   * @param next - Express next function
   */
  async use(_req: Request, _res: Response, next: NextFunction) {
    try {
      await this.authRlsService.setRlsContext(
        this.em,
        RequestContext.get(BaseUser),
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }

    next();
  }
}
