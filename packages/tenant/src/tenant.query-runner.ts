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

    console.log("@@@ TenantQueryRunner");

    await super.query(`SET "tenant.id" = '${ctx.tenantId || 1}';`);
    const result = await super.query(query, parameters, useStructuredResult);
    await super.query(`RESET "tenant.id";`);

    console.log("### TenantQueryRunner");

    return result;
  }
}
