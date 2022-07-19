import { TSMigrationGenerator } from "@mikro-orm/migrations";
import prettier from "prettier";
import { format, FormatFnOptions } from "sql-formatter";

export class MigrationGenerator extends TSMigrationGenerator {
  createStatement(sql: string, padLeft: number): string {
    const padding = " ".repeat(padLeft);

    const driverType = this.driver.config.get("type");

    let language: FormatFnOptions["language"];

    switch (driverType) {
      case "mysql":
        language = "mysql";
        break;
      case "mariadb":
        language = "mariadb";
        break;
      case "postgresql":
        language = "postgresql";
        break;
      default:
    }

    const formatSql = (language ? format(sql, { language }) : sql).replace(
      /['\\]/g,
      "\\'"
    );

    if (formatSql) {
      return `${padding}this.addSql(/* SQL */ \`
      ${formatSql.replace(/\n/g, `\n${padding}  `)}
    \`);\n\n`;
    }

    return "";
  }

  generateMigrationFile(
    className: string,
    diff: { up: string[]; down: string[] }
  ): string {
    return `/* eslint-disable */\n\n${prettier.format(
      super.generateMigrationFile(className, diff),
      {
        parser: "typescript",
      }
    )}`;
  }
}
