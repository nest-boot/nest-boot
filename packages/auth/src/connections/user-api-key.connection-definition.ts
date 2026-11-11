import type {
  ConnectionClass,
  ConnectionInterface,
} from "@nest-boot/graphql-connection";

import type { UserApiKey } from "../entities/user-api-key.entity.js";
import { ApiKeyConnection } from "./api-key.connection-definition.js";

/** Shared GraphQL connection, narrowed by the scoped service's mandatory owner filter. */
export const UserApiKeyConnection =
  ApiKeyConnection as ConnectionClass<UserApiKey>;
export type UserApiKeyConnection = ConnectionInterface<UserApiKey>;
export { ApiKeyConnectionArgs as UserApiKeyConnectionArgs } from "./api-key.connection-definition.js";
