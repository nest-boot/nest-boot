import { Type } from "@nestjs/common";

import { ConnectionInterface } from "../interfaces";

export type ConnectionClass<T> = Type<ConnectionInterface<T>>;
