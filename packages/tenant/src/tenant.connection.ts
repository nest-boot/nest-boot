import { Connection } from "typeorm";

export class TenantConnection extends Connection {
  constructor(connection: Connection) {
    super(connection.options);
  }
}
