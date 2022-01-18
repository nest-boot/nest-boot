/* eslint-disable no-console */

import { Injectable } from "@nestjs/common";
import { Connection, getConnection } from "typeorm";

import { Command, Option } from "../command.decorator";

@Injectable()
export class DatabaseCommand {
  @Command({
    command: "database:sync",
    describe: "将实体与数据库架构同步",
  })
  async sync(
    @Option({
      alias: "c",
      default: "default",
      describe: "运行查询的连接名称",
      name: "connectionName",
    })
    connectionName: string
  ): Promise<void> {
    let connection: Connection | undefined;
    try {
      connection = getConnection(connectionName);
      await connection.synchronize();
      await connection.close();

      console.log("Schema sync finished successfully.");
    } catch (err) {
      if (connection) await connection.close();

      console.log("Error during schema sync:");
      console.error(err);
      process.exit(1);
    }
  }

  @Command({
    command: "database:drop",
    describe: "删除数据库中的所有表",
  })
  async drop(
    @Option({
      alias: "c",
      default: "default",
      describe: "运行查询的连接名称",
      name: "connectionName",
    })
    connectionName: string
  ): Promise<void> {
    let connection: Connection;

    try {
      connection = getConnection(connectionName);
      await connection.dropDatabase();
      await connection.close();

      console.log("Database schema has been successfully dropped.");
    } catch (err) {
      if (connection) await connection.close();

      console.log("Error during database drop:");
      console.error(err);
      process.exit(1);
    }
  }

  @Command({
    command: "database:migration",
    describe: "运行所有未执行的迁移",
  })
  async migration(
    @Option({
      alias: "c",
      default: "default",
      describe: "运行查询的连接名称",
      name: "connectionName",
    })
    connectionName: string,
    @Option({
      alias: "t",
      default: "all",
      describe: "是否在运行迁移时启用事务",
      name: "transaction",
    })
    transaction: "all" | "none" | "each"
  ): Promise<void> {
    let connection: Connection;

    try {
      connection = getConnection(connectionName);

      await connection.runMigrations({ transaction });
      await connection.close();
      process.exit(0);
    } catch (err) {
      if (connection) await connection.close();

      console.log("Error during database migration:");
      console.error(err);
      process.exit(1);
    }
  }

  @Command({
    command: "database:rollback",
    describe: "回滚到上次执行的迁移",
  })
  async rollback(
    @Option({
      alias: "c",
      default: "default",
      describe: "运行查询的连接名称",
      name: "connectionName",
    })
    connectionName: string,
    @Option({
      alias: "t",
      default: "all",
      describe: "是否在运行迁移时启用事务",
      name: "transaction",
    })
    transaction: "all" | "none" | "each"
  ): Promise<void> {
    let connection: Connection;

    try {
      connection = getConnection(connectionName);

      await connection.undoLastMigration({ transaction });
      await connection.close();
    } catch (err) {
      if (connection) await connection.close();

      console.log("Error during database rollback:");
      console.error(err);
      process.exit(1);
    }
  }
}
