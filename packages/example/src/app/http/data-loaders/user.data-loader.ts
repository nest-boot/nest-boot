import { EntityDataLoader } from "@nest-boot/graphql";
import { Injectable, Scope } from "@nestjs/common";

import { User } from "../../core/entities/user.entity";
import { UserService } from "../../core/services/user.service";

@Injectable({ scope: Scope.REQUEST })
export class UserDataLoader extends EntityDataLoader<User> {
  constructor(entityService: UserService) {
    super(entityService);
  }
}
