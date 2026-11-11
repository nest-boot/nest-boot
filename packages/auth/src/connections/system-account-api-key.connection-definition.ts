import type {
  ConnectionClass,
  ConnectionInterface,
} from "@nest-boot/graphql-connection";

import type { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import { ApiKeyConnection } from "./api-key.connection-definition.js";

/** Shared GraphQL connection, narrowed by the scoped service's mandatory owner filter. */
export const SystemAccountApiKeyConnection =
  ApiKeyConnection as ConnectionClass<SystemAccountApiKey>;
export type SystemAccountApiKeyConnection =
  ConnectionInterface<SystemAccountApiKey>;
export { ApiKeyConnectionArgs as SystemAccountApiKeyConnectionArgs } from "./api-key.connection-definition.js";
