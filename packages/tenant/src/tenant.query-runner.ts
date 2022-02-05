/* eslint-disable @typescript-eslint/no-explicit-any */

import { Context } from "@nest-boot/common";
import { PostgresQueryRunner } from "typeorm/driver/postgres/PostgresQueryRunner";

export class TenantQueryRunner extends PostgresQueryRunner {
  async query(
    query: string,
    parameters?: any[],
    useStructuredResult = false
  ): Promise<any> {
    const ctx = Context.get();

    await super.query(`SET "app.current_tenant_id" = '${ctx?.tenantId || 0}';`);
    const result = await super.query(query, parameters, useStructuredResult);
    await super.query(`RESET "app.current_tenant_id";`);

    return result;
  }
}
