import type {
  ConnectionClass,
  ConnectionInterface,
} from "@nest-boot/graphql-connection";

import type { MemberApiKey } from "../entities/member-api-key.entity.js";
import { ApiKeyConnection } from "./api-key.connection-definition.js";

/** Shared GraphQL connection, narrowed by the scoped service's mandatory owner filter. */
export const MemberApiKeyConnection =
  ApiKeyConnection as ConnectionClass<MemberApiKey>;
export type MemberApiKeyConnection = ConnectionInterface<MemberApiKey>;
export { ApiKeyConnectionArgs as MemberApiKeyConnectionArgs } from "./api-key.connection-definition.js";
