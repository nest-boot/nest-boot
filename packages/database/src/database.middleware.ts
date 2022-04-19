import { Context } from "@nest-boot/common";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NestMiddleware } from "@nestjs/common";

@Injectable()
export class DatabaseMiddleware<TRequest = any, TResponse = any>
  implements NestMiddleware<TRequest, TResponse>
{
  constructor(private readonly entityManager: EntityManager) {}

  async use(req: TRequest, res: TResponse, next: () => void): Promise<void> {
    const ctx = Context.get();

    ctx.entityManager = this.entityManager.fork({ useContext: true });

    next();
  }
}
