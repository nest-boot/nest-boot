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

@Injectable()
export class AuthRlsMiddleware implements NestMiddleware {
  constructor(
    private readonly em: EntityManager,
    protected readonly authRlsService: AuthRlsService,
  ) {}

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
