/* eslint-disable no-console */

import { Command, Option, Positional } from "@nest-boot/command";
import { Injectable } from "@nestjs/common";
import { outputFile } from "fs-extra";
import {
  camelize,
  dasherize,
  pluralize,
  tableize,
  underscore,
} from "inflection";
import { Environment, FileSystemLoader } from "nunjucks";
import { resolve } from "path";
import prettier from "prettier";
import { format } from "sql-formatter";
import { Connection, getConnection } from "typeorm";
import { AuroraDataApiDriver } from "typeorm/driver/aurora-data-api/AuroraDataApiDriver";
import { MysqlDriver } from "typeorm/driver/mysql/MysqlDriver";

@Injectable()
export class DatabaseCommand {
  readonly template: Environment;

  readonly basePath = resolve(process.cwd(), `./src/`);

  constructor() {
    this.template = new Environment(
      new FileSystemLoader(resolve(__dirname, `../../templates/`))
    );

    this.template.addFilter("camelize", (value: string) =>
      camelize(value.replace(/-/g, "_"))
    );

    this.template.addFilter("dasherize", (value: string) =>
      dasherize(value.replace(/-/g, "_"))
    );

    this.template.addFilter("pluralize", (value: string) =>
      pluralize(value.replace(/-/g, "_"))
    );

    this.template.addFilter("tableize", (value: string) =>
      tableize(value.replace(/-/g, "_"))
    );

    this.template.addFilter("underscore", (value: string) =>
      underscore(value.replace(/-/g, "_"))
    );
  }

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
    command: "migration:run",
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
    command: "migration:rollback",
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

  @Command({
    command: "migration:create <name>",
    describe: "创建一个迁移",
  })
  async createMigration(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string,
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

      const sqlInMemory = await connection.driver.createSchemaBuilder().log();

      const upSqls: string[] = [];
      const downSqls: string[] = [];

      if (
        connection.driver instanceof MysqlDriver ||
        connection.driver instanceof AuroraDataApiDriver
      ) {
        sqlInMemory.upQueries.forEach((upQuery) => {
          upSqls.push(format(upQuery.query.replace(/"/g, `\\"`)));
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(format(downQuery.query.replace(/"/g, `\\"`)));
        });
      } else {
        sqlInMemory.upQueries.forEach((upQuery) => {
          upSqls.push(format(upQuery.query.replace(/`/g, "\\`")));
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(format(downQuery.query.replace(/`/g, "\\`")));
        });
      }

      if (upSqls.length) {
        const timestamp = new Date().getTime();

        const fileName = `${timestamp}-${dasherize(name).toLowerCase()}`;
        const migrationName = `${dasherize(name).toLowerCase()}-${timestamp}`;

        await this.render(
          `database/migrations/${fileName}.migration.ts`,
          "migration.njk",
          { name, migrationName, upSqls, downSqls: downSqls.reverse() }
        );

        console.log(
          `Migration ${migrationName} has been generated successfully.`
        );
      } else {
        console.log(
          `No changes in database schema were found - cannot generate a migration.`
        );
      }
      await connection.close();
    } catch (err) {
      if (connection) await (connection as Connection).close();

      console.log("Error during migration generation:");
      console.error(err);
      process.exit(1);
    }
  }

  async render(
    path: string,
    name: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    return await outputFile(
      resolve(this.basePath, path),
      prettier.format(this.template.render(name, context), {
        parser: "typescript",
      }),
      "utf-8"
    );
  }
}
