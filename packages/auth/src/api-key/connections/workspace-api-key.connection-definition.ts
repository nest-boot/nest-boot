import { ArgsType, ObjectType } from "@nest-boot/graphql";

import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { createApiKeyConnection } from "./create-api-key-connection.js";

const { Connection, ConnectionArgs } = createApiKeyConnection(WorkspaceApiKey);

/**
 * API key pagination arguments.
 */
@ArgsType()
export class WorkspaceApiKeyConnectionArgs extends ConnectionArgs {}

/**
 * A page of visible API keys.
 */
@ObjectType({ isAbstract: true })
export class WorkspaceApiKeyConnection extends Connection {}
