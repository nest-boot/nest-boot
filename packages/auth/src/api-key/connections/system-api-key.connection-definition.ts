import { ArgsType, ObjectType } from "@nest-boot/graphql";

import { SystemApiKey } from "../entities/system-api-key.entity.js";
import { createApiKeyConnection } from "./create-api-key-connection.js";

const { Connection, ConnectionArgs } = createApiKeyConnection(SystemApiKey);

/**
 * API key pagination arguments.
 */
@ArgsType()
export class SystemApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType({ isAbstract: true })
export class SystemApiKeyConnection extends Connection {}
