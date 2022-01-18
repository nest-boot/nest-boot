/* eslint-disable no-console */

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
import sqlFormatter from "sql-formatter";
import { Connection, getConnection } from "typeorm";
import { AuroraDataApiDriver } from "typeorm/driver/aurora-data-api/AuroraDataApiDriver";
import { MysqlDriver } from "typeorm/driver/mysql/MysqlDriver";

import { Command, Option, Positional } from "../command.decorator";

@Injectable()
export class CreateCodeCommand {
  readonly template: Environment;

  readonly basePath = resolve(process.cwd(), `./src/app/`);

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
    command: "create:command <name>",
    describe: "创建一个命令",
  })
  async createCommand(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string
  ): Promise<void> {
    await this.render(
      `console/commands/${dasherize(name).toLowerCase()}.command.ts`,
      "command.njk",
      { name }
    );
  }

  @Command({
    command: "create:controller <name>",
    describe: "创建一个控制器",
  })
  async createController(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string,
    @Option({
      alias: "r",
      describe: "是否创建一个 Rest API 控制器",
      name: "rest",
      type: "boolean",
    })
    rest: boolean
  ): Promise<void> {
    await this.render(
      `http/controllers/${dasherize(name).toLowerCase()}.controller.ts`,
      "controller.njk",
      { name, rest }
    );
  }

  @Command({
    command: "create:entity <name>",
    describe: "创建一个实体",
  })
  async createEntity(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string,
    @Option({
      alias: "s",
      describe: "是否可搜索",
      name: "searchable",
      type: "boolean",
    })
    searchable: boolean
  ): Promise<void> {
    await this.render(
      `database/entities/${dasherize(name).toLowerCase()}.entity.ts`,
      "entity.njk",
      { name, searchable }
    );
  }

  @Command({
    command: "create:migration <name>",
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
          upSqls.push(
            sqlFormatter.format(
              upQuery.query.replace(new RegExp(`"`, "g"), `\\"`)
            )
          );
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(
            sqlFormatter.format(
              downQuery.query.replace(new RegExp(`"`, "g"), `\\"`)
            )
          );
        });
      } else {
        sqlInMemory.upQueries.forEach((upQuery) => {
          upSqls.push(
            sqlFormatter.format(
              upQuery.query.replace(new RegExp("`", "g"), "\\`")
            )
          );
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(
            sqlFormatter.format(
              downQuery.query.replace(new RegExp("`", "g"), "\\`")
            )
          );
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

  @Command({
    command: "create:service <name>",
    describe: "创建一个服务",
  })
  async createService(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string,
    @Option({
      alias: "s",
      describe: "是否可搜索",
      name: "searchable",
      type: "boolean",
    })
    searchable: boolean
  ): Promise<void> {
    await this.render(
      `service/services/${dasherize(name).toLowerCase()}.service.ts`,
      "service.njk",
      { name, searchable }
    );
  }

  @Command({
    command: "create:data-loader <name>",
    describe: "创建一个 DataLoader",
  })
  async createDataLoader(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string
  ): Promise<void> {
    await this.render(
      `http/data-loaders/${dasherize(name).toLowerCase()}.data-loader.ts`,
      "data-loader.njk",
      { name }
    );
  }

  @Command({
    command: "create:queue <name>",
    describe: "创建一个队列",
  })
  async createQueue(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string
  ): Promise<void> {
    await this.render(
      `queue/queues/${dasherize(name).toLowerCase()}.queue.ts`,
      "queue.njk",
      { name }
    );
  }

  @Command({
    command: "create:resolver <name>",
    describe: "创建一个 GraphQL 解决器",
  })
  async createResolver(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string
  ): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`${name}`);
  }

  @Command({
    command: "create:graphql <name>",
    describe: "创建一组 GraphQL 代码",
  })
  async createGraphql(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string
  ): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`${name}`);
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
