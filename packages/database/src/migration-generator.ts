import { TSMigrationGenerator } from "@mikro-orm/migrations";
import prettier from "prettier";
import { format } from "sql-formatter";

export class MigrationGenerator extends TSMigrationGenerator {
  createStatement(sql: string, padLeft: number): string {
    const padding = " ".repeat(padLeft);

    const formatSql = format(sql, { language: "postgresql" }).replace(
      /['\\]/g,
      "\\'"
    );

    return `${padding}this.addSql(/* SQL */ \`
      ${formatSql.replace(/\n/g, `\n${padding}  `)}
    \`);\n\n`;
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
