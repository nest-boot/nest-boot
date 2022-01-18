import { getRuntimeContext, RuntimeContext } from "@nest-boot/common";
import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/typeorm";
import {
  Connection,
  EntityManager,
  EntitySchema,
  getRepository,
  ObjectType,
  Repository,
} from "typeorm";

@Injectable()
export class TransactionalConnection {
  constructor(@InjectConnection() private readonly connection: Connection) {
    return this;
  }

  get rawConnection(): Connection {
    return this.connection;
  }

  getRepository<Entity>(
    target: ObjectType<Entity> | EntitySchema<Entity> | string
  ): Repository<Entity> {
    const ctx = getRuntimeContext();

    if (ctx) {
      const transactionManager = this.getTransactionManager(ctx);

      if (
        transactionManager &&
        target &&
        !transactionManager.queryRunner?.isReleased
      ) {
        return transactionManager.getRepository(target);
      }
    }

    return getRepository(target);
  }

  async startTransaction(ctx: RuntimeContext): Promise<void> {
    const transactionManager = this.getTransactionManager(ctx);
    if (transactionManager?.queryRunner?.isTransactionActive === false) {
      await transactionManager.queryRunner.startTransaction();
    }
  }

  private getTransactionManager(ctx: RuntimeContext): EntityManager {
    return ctx.transactionQueryRunner?.manager;
  }
}
