import { TSMigrationGenerator } from "@mikro-orm/migrations";
import { format, FormatOptions } from "sql-formatter";

export class MigrationGenerator extends TSMigrationGenerator {
  createStatement(sql: string, padLeft: number): string {
    const driverType = this.driver.config.get("type");
    let language: FormatOptions["language"];

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

    return super.createStatement(
      language ? format(sql, { language }) : sql,
      padLeft
    );
  }
}
