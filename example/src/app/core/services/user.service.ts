import { createEntityService } from "@nest-boot/database";
import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";

import { User } from "../entities/user.entity";

@Injectable()
export class UserService extends mixinConnection(
  mixinSearchable<User>(createEntityService(User))
) {}
