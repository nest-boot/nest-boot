import { type EntityClass } from "@mikro-orm/core";

import { PersonalAccessToken, User } from "../entities";

export interface AuthModuleOptions {
  entities?: {
    User?: EntityClass<User>;
    PersonalAccessToken?: EntityClass<PersonalAccessToken>;
  };

  expiresIn?: number;

  defaultRequireAuth?: boolean;
}
