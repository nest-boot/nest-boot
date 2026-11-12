import { ArgsType, ObjectType } from "@nest-boot/graphql";

import { UserApiKey } from "../objects/user-api-key.object.js";
import { createApiKeyConnection } from "./create-api-key-connection.js";

const { Connection, ConnectionArgs } = createApiKeyConnection(UserApiKey);

/**
 * API key pagination arguments.
 */
@ArgsType()
export class UserApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType({ isAbstract: true })
export class UserApiKeyConnection extends Connection {}
